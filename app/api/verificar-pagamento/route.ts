import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { paymentId, vendaId } = await request.json()

    if (!paymentId || !vendaId) {
      return NextResponse.json({ 
        success: false, 
        error: 'paymentId e vendaId são obrigatórios' 
      })
    }

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!mpToken || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Configuração ausente' 
      })
    }

    // Consultar status do pagamento no Mercado Pago
    console.log('🔍 Verificando pagamento:', paymentId)
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${mpToken}` }
      }
    )

    if (!mpResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: 'Erro ao consultar Mercado Pago' 
      })
    }

    const payment = await mpResponse.json()
    console.log('💳 Status do pagamento:', payment.status)

    // Se não foi aprovado ainda, retorna pendente
    if (payment.status !== 'approved') {
      return NextResponse.json({ 
        success: true, 
        status: 'pendente',
        mpStatus: payment.status
      })
    }

    // Pagamento APROVADO! Buscar venda e atualizar
    console.log('✅ Pagamento aprovado! Buscando venda...')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar venda com produtos
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', vendaId)
      .single()

    if (vendaError || !venda) {
      console.error('❌ Venda não encontrada')
      return NextResponse.json({ 
        success: false, 
        error: 'Venda não encontrada' 
      })
    }

    // Evitar duplicidade
    if (venda.status === 'pago') {
      console.log('✅ Venda já estava paga')
      return NextResponse.json({ 
        success: true, 
        status: 'pago',
        alreadyPaid: true
      })
    }

    // ========================================
    // BAIXAR ESTOQUE DOS PRODUTOS
    // ========================================
    console.log('📦 Baixando estoque dos produtos...')
    
    for (const item of venda.produtos) {
      try {
        // Buscar produto
        const { data: produto } = await supabase
          .from('produtos')
          .select('id, nome, estoque')
          .eq('id', item.id)
          .single()

        if (!produto) {
          console.error(`❌ Produto ${item.id} não encontrado`)
          continue
        }

        // Novo estoque
        const novoEstoque = produto.estoque - item.qtd

        if (novoEstoque < 0) {
          console.warn(`⚠️ ${produto.nome} ficará com estoque negativo (${novoEstoque})`)
        }

        // Atualizar
        await supabase
          .from('produtos')
          .update({ estoque: novoEstoque })
          .eq('id', item.id)

        console.log(`✅ ${produto.nome}: ${produto.estoque} → ${novoEstoque}`)
      } catch (err) {
        console.error(`❌ Erro ao atualizar produto ${item.id}:`, err)
      }
    }

    console.log('✅ Estoque atualizado!')

    // ========================================
    // ATUALIZAR VENDA
    // ========================================
    console.log('💾 Atualizando venda para PAGO...')
    const { error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        mp_payment_id: payment.id
      })
      .eq('id', vendaId)

    if (updateError) {
      console.error('❌ Erro ao atualizar venda:', updateError)
      return NextResponse.json({ 
        success: false, 
        error: 'Erro ao atualizar banco' 
      })
    }

    console.log('✅ Venda atualizada com sucesso!')
    return NextResponse.json({ 
      success: true, 
      status: 'pago',
      vendaId,
      estoqueAtualizado: true
    })

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    })
  }
}