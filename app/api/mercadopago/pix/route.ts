import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { total, dadosCliente, carrinho } = await request.json()

    if (!total || !dadosCliente || !carrinho?.length) {
      return NextResponse.json(
        { error: 'Dados inválidos para gerar PIX' },
        { status: 400 }
      )
    }

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    if (!token || !baseUrl) {
      console.error('❌ Variáveis de ambiente ausentes')
      return NextResponse.json(
        { error: 'Configuração de pagamento ausente' },
        { status: 500 }
      )
    }

    // ✅ Valor arredondado corretamente
    const valorArredondado = Math.round(Number(total) * 100) / 100

    // ✅ Idempotency Key
    const idempotencyKey = randomUUID()

    console.log('═══════════════════════════════════════')
    console.log('💰 PIX sendo gerado:')
    console.log('Valor:', valorArredondado)
    console.log('Cliente:', dadosCliente.nome)
    console.log('Idempotency Key:', idempotencyKey)
    console.log('Webhook:', `${baseUrl}/api/webhook`)
    console.log('═══════════════════════════════════════')

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: valorArredondado,
        description: `Pedido - ${carrinho.length} itens`,
        payment_method_id: 'pix',

        // ✅ ESSENCIAL PARA O WEBHOOK FUNCIONAR
        notification_url: `${baseUrl}/api/webhook`,

        payer: {
          email:
            dadosCliente.email ||
            `${dadosCliente.nome.toLowerCase().replace(/\s/g, '')}@email.com`,
          first_name: dadosCliente.nome.split(' ')[0],
          last_name:
            dadosCliente.nome.split(' ').slice(1).join(' ') ||
            dadosCliente.nome.split(' ')[0],
          identification: {
            type: 'CPF',
            number: dadosCliente.cpf.replace(/\D/g, '')
          }
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Erro Mercado Pago:', data)
      return NextResponse.json(
        { error: 'Erro ao gerar PIX', details: data },
        { status: response.status }
      )
    }

    console.log('✅ PIX gerado com sucesso!')
    console.log('ID do pagamento:', data.id)
    console.log('Status:', data.status)

    return NextResponse.json({
      id: data.id,
      status: data.status,
      qr_code: data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
      ticket_url: data.point_of_interaction.transaction_data.ticket_url
    })
  } catch (error: any) {
    console.error('❌ Erro interno:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', message: error.message },
      { status: 500 }
    )
  }
}
