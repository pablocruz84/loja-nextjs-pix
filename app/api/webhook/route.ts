import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('═══════════════════════════════════════')
    console.log('📩 WEBHOOK MERCADO PAGO RECEBIDO')
    console.log(JSON.stringify(body, null, 2))
    console.log('═══════════════════════════════════════')

    // 🧠 Ignora eventos que não são de pagamento
    if (body?.type !== 'payment' && body?.action !== 'payment.updated') {
      console.log('ℹ️ Evento ignorado:', body?.type || body?.action)
      return NextResponse.json({ received: true })
    }

    // 🔑 Payment ID pode vir em formatos diferentes
    const paymentId = String(body?.data?.id || body?.id || '')

    if (!paymentId) {
      console.log('⚠️ Webhook sem payment id')
      return NextResponse.json({ received: true })
    }

    // 🔐 Variáveis de ambiente
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!mpToken || !supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente faltando')
      return NextResponse.json({ received: true })
    }

    // 🔍 Consulta pagamento no Mercado Pago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text()
      console.error('❌ Erro ao consultar pagamento no Mercado Pago')
      console.error('Status:', mpResponse.status)
      console.error('Resposta:', errorText)
      return NextResponse.json({ received: true })
    }

    const payment = await mpResponse.json()

    console.log('💳 PAGAMENTO CONSULTADO:')
    console.log('- ID:', payment.id)
    console.log('- STATUS:', payment.status)
    console.log('- EXTERNAL_REFERENCE:', payment.external_reference)


    console.log('🔎 DEBUG external_reference:', payment.external_reference)
    console.log('🔎 TIPO:', typeof payment.external_reference)


    // ⏳ Ainda não aprovado
    if (payment.status !== 'approved') {
      console.log('⏳ Pagamento ainda não aprovado')
      return NextResponse.json({ received: true })
    }

    if (!payment.external_reference) {
      console.error('❌ Pagamento aprovado sem external_reference')
      return NextResponse.json({ received: true })
    }

    // 🔗 Supabase (SERVICE ROLE)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 🔎 Busca venda pelo ID salvo no external_reference
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', payment.external_reference)
      .single()

    if (vendaError || !venda) {
      console.error('❌ Venda não encontrada:', vendaError)
      return NextResponse.json({ received: true })
    }

    // 🛑 Evita duplicidade
    if (venda.status === 'pago') {
      console.log('✅ Venda já estava paga')
      return NextResponse.json({ received: true, alreadyPaid: true })
    }

    // ✅ Atualiza venda
    const { error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        mp_payment_id: payment.id
      })
      .eq('id', venda.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar venda:', updateError)
      return NextResponse.json({ received: true })
    }

    console.log('✅ VENDA ATUALIZADA COM SUCESSO:', venda.id)
    console.log('═══════════════════════════════════════')

    return NextResponse.json({
      received: true,
      updated: true,
      vendaId: venda.id
    })

  } catch (error) {
    console.error('═══════════════════════════════════════')
    console.error('❌ ERRO FATAL NO WEBHOOK')
    console.error(error)
    console.error('═══════════════════════════════════════')
    return NextResponse.json({ received: true })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook Mercado Pago ativo',
    time: new Date().toISOString()
  })
}
