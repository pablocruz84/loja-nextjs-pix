import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gerarPedidoPDF, pdfParaBase64 } from '@/lib/gerarPedidoPDF'

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
      return NextResponse.json({ received: true })
    }

    // 🔎 Busca venda
    const { data: venda, error } = await supabase
      .from('vendas')
      .select('*')
      .eq('pix_id', String(paymentId))
      .single()

    if (error || !venda) {
      console.error('❌ Venda não encontrada:', error)
      return NextResponse.json({ received: true })
    }

    // 🛑 Evita duplicidade
    if (venda.email_enviado) {
      console.log('⚠️ Email já enviado')
      return NextResponse.json({ received: true })
    }

    // ✅ Atualiza venda
    await supabase
      .from('vendas')
      .update({
        status: 'approved',
        data_pagamento: new Date().toISOString()
      })
      .eq('id', venda.id)

    // 📄 Gera PDF
    const pdf = gerarPedidoPDF({
      pedidoId: `#${String(venda.id).padStart(6, '0')}`,
      data: new Date().toLocaleDateString('pt-BR'),
      cliente: venda.cliente,
      itens: venda.itens,
      subtotal: venda.subtotal,
      taxaEntrega: venda.taxa_entrega,
      total: venda.total
    })

    const pdfBase64 = pdfParaBase64(pdf)

    // 🌐 Descobre domínio automaticamente
    const origin = request.nextUrl.origin

    // 📧 Envia email
    await fetch(`${origin}/api/enviar-pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedidoId: `#${String(venda.id).padStart(6, '0')}`,
        nomeCliente: venda.cliente.nome,
        emailCliente: venda.cliente.email,
        pdfBase64
      })
    })

    // 🏁 Marca como enviado
    await supabase
      .from('vendas')
      .update({ email_enviado: true })
      .eq('id', venda.id)

    console.log('✅ Venda aprovada e email enviado:', venda.id)

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error)
    return NextResponse.json({ received: true })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Webhook Mercado Pago ativo' })
}
