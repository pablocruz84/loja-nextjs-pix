import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('📩 WEBHOOK RECEBIDO:', JSON.stringify(body, null, 2))

    const paymentId = body?.data?.id || body?.id
    if (!paymentId) return NextResponse.json({ received: true, error: 'No payment ID' })

    // Variáveis de ambiente
    const hasToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    const hasAppUrl = !!process.env.NEXT_PUBLIC_APP_URL
    if (!hasToken || !hasSupabaseUrl || !hasSupabaseKey || !hasAppUrl) {
      return NextResponse.json({ received: true, error: 'Missing environment variables' })
    }

    // Consulta pagamento no Mercado Pago
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } }
    )
    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      return NextResponse.json({ received: true, error: 'MP API error', details: errorText })
    }
    const payment = await paymentResponse.json()
    if (payment.status !== 'approved') return NextResponse.json({ received: true, status: payment.status })

    // Cria cliente Supabase
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Busca venda
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('pix_id', String(paymentId))
      .single()
    if (vendaError || !venda) return NextResponse.json({ received: true, error: 'Venda não encontrada' })

    if (venda.status === 'pago') return NextResponse.json({ received: true, alreadyPaid: true, vendaId: venda.id })

    // Atualiza venda para PAGO
    const { data: vendaAtualizada, error: updateError } = await supabase
      .from('vendas')
      .update({ status: 'pago', data_pagamento: new Date().toISOString() })
      .eq('id', venda.id)
      .select()
    if (updateError) return NextResponse.json({ received: true, error: 'Erro ao atualizar venda', details: updateError })

    // Dispara email do pedido
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/enviar-pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedidoId: venda.id,
        nomeCliente: venda.cliente_nome,
        pdfBase64: venda.pdf_base64 // Assumindo que você já salva o PDF em base64
      })
    })

    return NextResponse.json({ received: true, updated: true, vendaId: venda.id, newStatus: 'pago' })

  } catch (error: any) {
    return NextResponse.json({ received: true, error: error.message, errorType: error.constructor.name })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webhook Mercado Pago ativo',
    timestamp: new Date().toISOString()
  })
}
