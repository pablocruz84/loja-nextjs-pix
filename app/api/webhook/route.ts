// ═══════════════════════════════════════════════════════════
// ARQUIVO: app/api/webhook/route.ts
// ═══════════════════════════════════════════════════════════
// Webhook para receber notificações do PagBank

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('═══════════════════════════════════════')
    console.log('📩 WEBHOOK PAGBANK RECEBIDO')
    console.log(JSON.stringify(body, null, 2))
    console.log('═══════════════════════════════════════')

    // 🔑 PagBank envia notificações com diferentes estruturas
    // Formato: { id: "ORDE_...", reference_id: "...", created_at: "..." }
    const orderId = body?.id
    const referenceId = body?.reference_id

    if (!orderId) {
      console.log('⚠️ Webhook sem order id')
      return NextResponse.json({ received: true })
    }

    console.log('📦 Order ID encontrado:', orderId)
    console.log('🔗 Reference ID:', referenceId)

    // 🔐 Variáveis de ambiente
    const pagbankToken = process.env.PAGBANK_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!pagbankToken || !supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente faltando')
      return NextResponse.json({ received: true })
    }

    // 🔍 Buscar pedido no PagBank para confirmar status
    console.log('🔍 Consultando pedido no PagBank...')
    const pagbankResponse = await fetch(
      `https://api.pagseguro.com/orders/${orderId}`,
      {
        headers: { 
          'Authorization': `Bearer ${pagbankToken}`,
          'x-api-version': '4.0'
        }
      }
    )

    if (!pagbankResponse.ok) {
      console.error('❌ Erro ao consultar pedido no PagBank')
      const text = await pagbankResponse.text()
      console.error('Detalhes:', text)
      return NextResponse.json({ received: true })
    }

    const order = await pagbankResponse.json()

    console.log('📦 PEDIDO CONSULTADO:')
    console.log('- ID:', order.id)
    console.log('- STATUS:', order.status)
    console.log('- REFERENCE_ID:', order.reference_id)
    console.log('- CHARGES:', order.charges?.length || 0)

    // ⏳ Verificar status do pagamento
    // Status PagBank: PAID, WAITING, DECLINED, CANCELED
    const isPaid = order.status === 'PAID' || 
                   order.charges?.some((charge: any) => charge.status === 'PAID')

    if (!isPaid) {
      console.log('⏳ Pagamento ainda não confirmado, status:', order.status)
      return NextResponse.json({ received: true, status: order.status })
    }

    if (!order.reference_id) {
      console.error('❌ Pedido pago sem reference_id')
      return NextResponse.json({ received: true })
    }

    // 🔍 Extrair ID da venda do reference_id
    // Formato esperado: "VENDA-123-1234567890"
    const vendaIdMatch = order.reference_id.match(/VENDA-(\d+)/)
    if (!vendaIdMatch) {
      console.error('❌ Reference ID não contém ID da venda:', order.reference_id)
      return NextResponse.json({ received: true, error: 'Reference ID inválido' })
    }

    const vendaId = vendaIdMatch[1]
    console.log('🎯 ID da venda extraído:', vendaId)

    // 🔗 Conexão Supabase (SERVICE ROLE)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 🔎 Buscar venda pelo ID
    console.log('🔎 Buscando venda com ID:', vendaId)
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', vendaId)
      .single()

    if (vendaError || !venda) {
      console.error('❌ Venda não encontrada:', vendaError)
      return NextResponse.json({ received: true, error: 'Venda não encontrada' })
    }

    console.log('📦 VENDA ENCONTRADA:')
    console.log('- ID:', venda.id)
    console.log('- Status atual:', venda.status)

    // 🛑 Evita duplicidade
    if (venda.status === 'pago') {
      console.log('✅ Venda já estava marcada como paga')
      return NextResponse.json({ received: true, alreadyPaid: true })
    }

    // ✅ Atualizar venda para PAGO
    console.log('💾 Atualizando venda para PAGO...')
    const { error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        pagbank_order_id: order.id,
        pagbank_reference_id: order.reference_id
      })
      .eq('id', venda.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar venda:', updateError)
      return NextResponse.json({ received: true, error: 'Erro ao atualizar' })
    }

    console.log('✅ VENDA ATUALIZADA COM SUCESSO:', venda.id)
    console.log('═══════════════════════════════════════')

    return NextResponse.json({
      received: true,
      updated: true,
      vendaId: venda.id,
      orderId: order.id
    })

  } catch (error: any) {
    console.error('═══════════════════════════════════════')
    console.error('❌ ERRO FATAL NO WEBHOOK')
    console.error(error)
    console.error('═══════════════════════════════════════')

    return NextResponse.json({ received: true, error: error.message })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook PagBank ativo',
    time: new Date().toISOString()
  })
}