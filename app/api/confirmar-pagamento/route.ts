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

    // Pagamento APROVADO! Atualizar banco
    console.log('✅ Pagamento aprovado! Atualizando banco...')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        mp_payment_id: payment.id
      })
      .eq('id', vendaId)

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError)
      return NextResponse.json({ 
        success: false, 
        error: 'Erro ao atualizar banco' 
      })
    }

    console.log('✅ Venda atualizada com sucesso!')
    return NextResponse.json({ 
      success: true, 
      status: 'pago',
      vendaId
    })

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    })
  }
}