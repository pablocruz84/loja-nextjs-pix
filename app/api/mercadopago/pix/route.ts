// /app/api/pix/gerarPix.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { total, dadosCliente, carrinho } = await request.json()

    if (!total || !dadosCliente || !carrinho?.length) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos para gerar PIX' },
        { status: 400 }
      )
    }

    // Variáveis de ambiente
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!mpToken || !baseUrl || !supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente ausentes')
      return NextResponse.json(
        { success: false, error: 'Configuração ausente' },
        { status: 500 }
      )
    }

    // Conectar ao Supabase
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Criar a venda no Supabase antes de gerar PIX
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .insert({
        total,
        dados_cliente: dadosCliente,
        carrinho,
        status: 'pendente', // status inicial
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (vendaError || !venda) {
      console.error('❌ Erro ao criar venda no Supabase:', vendaError)
      return NextResponse.json(
        { success: false, error: 'Erro ao criar venda', details: vendaError },
        { status: 500 }
      )
    }

    // Arredondar valor
    const valorArredondado = Math.round(Number(total) * 100) / 100
    const idempotencyKey = randomUUID()

    console.log('═══════════════════════════════════════')
    console.log('💰 PIX sendo gerado:')
    console.log('Valor:', valorArredondado)
    console.log('Cliente:', dadosCliente.nome)
    console.log('Webhook:', `${baseUrl}/api/webhook`)
    console.log('External Reference (venda.id):', venda.id)
    console.log('═══════════════════════════════════════')

    // Criar pagamento PIX no Mercado Pago
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpToken}`,
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: valorArredondado,
        description: `Pedido - ${carrinho.length} itens`,
        payment_method_id: 'pix',
        notification_url: `${baseUrl}/api/webhook`, // webhook configurado
        external_reference: venda.id, // ID da venda para referência
        payer: {
          email:
            dadosCliente.email ||
            `${dadosCliente.nome.toLowerCase().replace(/\s/g, '')}@email.com`,
          first_name: dadosCliente.nome.split(' ')[0],
          last_name: dadosCliente.nome.split(' ').slice(1).join(' ') || dadosCliente.nome.split(' ')[0],
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
        { success: false, error: 'Erro ao gerar PIX', details: data },
        { status: response.status }
      )
    }

    console.log('✅ PIX gerado com sucesso!')
    console.log('ID do pagamento:', data.id)

    // Salvar ID do pagamento no Supabase
    await supabase
      .from('vendas')
      .update({ mp_payment_id: data.id })
      .eq('id', venda.id)

    return NextResponse.json({
      success: true,
      vendaId: venda.id,
      id: data.id,
      status: data.status,
      qr_code: data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
      ticket_url: data.point_of_interaction.transaction_data.ticket_url
    })
  } catch (error: any) {
    console.error('❌ Erro interno:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', message: error.message },
      { status: 500 }
    )
  }
}
