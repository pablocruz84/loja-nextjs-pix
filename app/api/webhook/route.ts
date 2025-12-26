import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('═══════════════════════════════════════')
    console.log('📩 WEBHOOK MERCADO PAGO RECEBIDO')
    console.log(JSON.stringify(body, null, 2))
    console.log('═══════════════════════════════════════')

    const paymentId = body?.data?.id
    if (!paymentId) {
      console.log('⚠️ Webhook sem payment id')
      return NextResponse.json({ received: true })
    }

    // 🔐 Variáveis de ambiente
    if (
      !process.env.MERCADOPAGO_ACCESS_TOKEN ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error('❌ Variáveis de ambiente faltando')
      return NextResponse.json({ received: true, error: 'env missing' })
    }

    // 🔍 Buscar pagamento no Mercado Pago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      }
    )

    if (!mpResponse.ok) {
      console.error('❌ Erro ao consultar pagamento MP')
      return NextResponse.json({ received: true })
    }

    const payment = await mpResponse.json()

    console.log('💳 PAGAMENTO:')
    console.log('- ID:', payment.id)
    console.log('- STATUS:', payment.status)
    console.log('- EXTERNAL_REFERENCE:', payment.external_reference)

    if (payment.status !== 'approved') {
      console.log('⏳ Pagamento ainda não aprovado')
      return NextResponse.json({ received: true })
    }

    if (!payment.external_reference) {
      console.error('❌ Pagamento sem external_reference')
      return NextResponse.json({ received: true })
    }

    // 🔗 Conexão Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 🔎 Buscar venda PELO external_reference
    const { data: venda, error } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', payment.external_reference)
      .single()

    if (error || !venda) {
      console.error('❌ Venda não encontrada:', error)
      return NextResponse.json({ received: true })
    }

    if (venda.status === 'pago') {
      console.log('✅ Venda já estava paga')
      return NextResponse.json({ received: true })
    }

    // ✅ Atualizar venda
    await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        mp_payment_id: payment.id
      })
      .eq('id', venda.id)

    console.log('✅ Venda atualizada para PAGO:', venda.id)
    console.log('═══════════════════════════════════════')

    return NextResponse.json({ received: true, updated: true })

  } catch (error: any) {
    console.error('❌ ERRO NO WEBHOOK:', error)
    return NextResponse.json({ received: true })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook Mercado Pago ativo',
    time: new Date().toISOString()
  })
}
