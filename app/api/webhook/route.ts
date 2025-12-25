// app/api/webhook/route.ts - VERSÃO CORRIGIDA

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
      console.log('⚠️ Sem payment ID')
      return NextResponse.json({ received: true })
    }

    // 🔍 Consulta pagamento no Mercado Pago
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

    if (payment.status !== 'approved') {
      console.log('⏳ Pagamento não aprovado ainda')
      return NextResponse.json({ received: true })
    }

    // 🔎 Busca venda
    const { data: venda, error } = await supabase
      .from('vendas')
      .select('*, clientes(*)')
      .eq('pix_id', String(paymentId))
      .single()

    if (error || !venda) {
      console.error('❌ Venda não encontrada:', error)
      return NextResponse.json({ received: true })
    }

    console.log('📦 Venda encontrada:', venda.id)

    // 🛑 Evita duplicidade
    if (venda.status === 'pago') {
      console.log('✅ Venda já foi marcada como paga')
      return NextResponse.json({ received: true })
    }

    // ✅ Atualiza venda para PAGO
    const { error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',  // ✅ CORRETO - deve ser 'pago'
        data_pagamento: new Date().toISOString()
      })
      .eq('id', venda.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar venda:', updateError)
      return NextResponse.json({ received: true })
    }

    console.log('✅ Venda atualizada para PAGO:', venda.id)

    // 📧 Email será enviado pelo polling no frontend
    // Não precisa enviar aqui

    return NextResponse.json({ 
      received: true,
      updated: true,
      vendaId: venda.id
    })

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error)
    return NextResponse.json({ 
      received: true,
      error: error.message 
    })
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook Mercado Pago ativo',
    timestamp: new Date().toISOString()
  })
}