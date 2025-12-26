// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  let body: any = {}

  // 🔹 Webhook pode chegar sem JSON
  try {
    body = await request.json()
  } catch {
    console.warn('⚠️ Webhook recebido sem JSON válido')
  }

  console.log('═══════════════════════════════════════')
  console.log('📩 WEBHOOK RECEBIDO')
  console.log('Body completo:', JSON.stringify(body, null, 2))
  console.log('═══════════════════════════════════════')

  // 🔹 Ignora eventos que não são pagamento
  const eventType = body?.type || body?.action
  console.log('📌 Tipo de evento:', eventType)

  if (eventType && !String(eventType).includes('payment')) {
    console.log('ℹ️ Evento ignorado (não é pagamento)')
    return NextResponse.json({ received: true, ignored: true })
  }

  const paymentId = body?.data?.id || body?.id

  if (!paymentId) {
    console.log('⚠️ Sem payment ID no body')
    return NextResponse.json({ received: true, error: 'No payment ID' })
  }

  console.log('💳 Payment ID encontrado:', paymentId)

  // 🔹 Variáveis de ambiente (SERVER)
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('🔐 Variáveis de ambiente:')
  console.log('- MERCADOPAGO_ACCESS_TOKEN:', mpToken ? '✅' : '❌')
  console.log('- SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌')

  if (!mpToken || !supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente faltando!')
    return NextResponse.json({ received: true, error: 'Missing env vars' })
  }

  // 🔹 Consulta pagamento no Mercado Pago
  console.log('🔍 Consultando pagamento no Mercado Pago...')

  const paymentResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${mpToken}`
      }
    }
  )

  if (!paymentResponse.ok) {
    const errorText = await paymentResponse.text()
    console.error('❌ Erro Mercado Pago:', paymentResponse.status)
    console.error('Resposta:', errorText)
    return NextResponse.json({ received: true, error: 'MP API error' })
  }

  const payment = await paymentResponse.json()

  console.log('💳 Dados do pagamento:')
  console.log('- ID:', payment.id)
  console.log('- Status:', payment.status)
  console.log('- Valor:', payment.transaction_amount)

  if (payment.status !== 'approved') {
    console.log('⏳ Pagamento não aprovado ainda')
    return NextResponse.json({ received: true, status: payment.status })
  }

  // 🔹 Supabase (SERVICE ROLE)
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔎 Buscando venda com pix_id:', String(paymentId))

  const { data: venda, error: vendaError } = await supabase
    .from('vendas')
    .select('*')
    .eq('pix_id', String(paymentId))
    .single()

  if (vendaError || !venda) {
    console.error('❌ Venda não encontrada:', vendaError)
    return NextResponse.json({ received: true, error: 'Venda não encontrada' })
  }

  console.log('📦 Venda encontrada:')
  console.log('- ID:', venda.id)
  console.log('- Status:', venda.status)
  console.log('- Total:', venda.total)

  // 🔹 Validação de valor (SEGURANÇA)
  if (Number(payment.transaction_amount) !== Number(venda.total)) {
    console.error('❌ Valor divergente!')
    console.error('MP:', payment.transaction_amount)
    console.error('Venda:', venda.total)

    return NextResponse.json({
      received: true,
      error: 'Valor do pagamento não confere'
    })
  }

  // 🔹 Evita duplicidade
  if (venda.status === 'pago') {
    console.log('✅ Venda já está paga, ignorando')
    return NextResponse.json({
      received: true,
      alreadyPaid: true,
      vendaId: venda.id
    })
  }

  // 🔹 Atualiza venda
  console.log('💾 Atualizando venda para PAGO...')

  const { error: updateError } = await supabase
    .from('vendas')
    .update({
      status: 'pago',
      data_pagamento: new Date().toISOString()
    })
    .eq('id', venda.id)

  if (updateError) {
    console.error('❌ Erro ao atualizar venda:', updateError)
    return NextResponse.json({ received: true, error: 'Update error' })
  }

  console.log('✅ Venda atualizada com sucesso!')
  console.log('═══════════════════════════════════════')

  return NextResponse.json({
    received: true,
    updated: true,
    vendaId: venda.id,
    newStatus: 'pago'
  })
}

// 🔹 Health check
export async function GET() {
  return NextResponse.json({
    message: 'Webhook Mercado Pago ativo',
    timestamp: new Date().toISOString()
  })
}
