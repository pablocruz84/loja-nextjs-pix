import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📩 Webhook recebido:', body)

    const paymentId = body?.data?.id || body?.id
    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      }
    )

    const payment = await paymentResponse.json()
    console.log('💳 Status do pagamento:', payment.status)

    if (payment.status === 'approved') {
      const { data: venda, error } = await supabase
        .from('vendas')
        .select('*')
        .eq('pix_id', String(paymentId))
        .single()

      if (error || !venda) {
        console.error('❌ Venda não encontrada:', error)
        return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
      }

      const { error: updateError } = await supabase
        .from('vendas')
        .update({
          status: 'approved',
          data_pagamento: new Date().toISOString()
        })
        .eq('id', venda.id)

      if (updateError) {
        console.error('❌ Erro ao atualizar venda:', updateError)
        return NextResponse.json({ error: 'Erro ao atualizar venda' }, { status: 500 })
      }

      console.log('✅ Venda aprovada:', venda.id)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error)
    return NextResponse.json(
      { error: 'Erro no webhook', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Webhook Mercado Pago ativo' })
}
