// ═══════════════════════════════════════════════════════════
// ARQUIVO: app/api/webhook/route.ts
// ═══════════════════════════════════════════════════════════
// SUBSTITUA TODO O CONTEÚDO POR ESTE:

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('═══════════════════════════════════════')
    console.log('📩 WEBHOOK MERCADO PAGO RECEBIDO')
    console.log(JSON.stringify(body, null, 2))
    console.log('═══════════════════════════════════════')

    // 🔑 Mercado Pago pode enviar o ID em diferentes formatos
    const paymentId = body?.data?.id || body?.id
    if (!paymentId) {
      console.log('⚠️ Webhook sem payment id')
      return NextResponse.json({ received: true })
    }

    console.log('💳 Payment ID encontrado:', paymentId)

    // 🔐 Variáveis de ambiente
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!mpToken || !supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente faltando')
      return NextResponse.json({ received: true })
    }

    // 🔍 Buscar pagamento no Mercado Pago
    console.log('🔍 Consultando pagamento no Mercado Pago...')
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${mpToken}` }
      }
    )

    if (!mpResponse.ok) {
      console.error('❌ Erro ao consultar pagamento no Mercado Pago')
      const text = await mpResponse.text()
      console.error('Detalhes:', text)
      return NextResponse.json({ received: true })
    }

    const payment = await mpResponse.json()

    console.log('💳 PAGAMENTO CONSULTADO:')
    console.log('- ID:', payment.id)
    console.log('- STATUS:', payment.status)
    console.log('- EXTERNAL_REFERENCE:', payment.external_reference)

    // ⏳ Ignora se não estiver aprovado
    if (payment.status !== 'approved') {
      console.log('⏳ Pagamento ainda não aprovado, status:', payment.status)
      return NextResponse.json({ received: true, status: payment.status })
    }

    if (!payment.external_reference) {
      console.error('❌ Pagamento aprovado sem external_reference')
      return NextResponse.json({ received: true })
    }

    // 🔗 Conexão Supabase (SERVICE ROLE)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 🔎 Buscar venda PELO external_reference (ID DA VENDA)
    console.log('🔎 Buscando venda com ID:', payment.external_reference)
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', payment.external_reference)
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
        mp_payment_id: payment.id
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
      vendaId: venda.id
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
    status: 'Webhook Mercado Pago ativo',
    time: new Date().toISOString()
  })
}