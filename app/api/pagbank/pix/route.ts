// ═══════════════════════════════════════════════════════════════
// ARQUIVO: app/api/pagbank/pix/route.ts
// ═══════════════════════════════════════════════════════════════
// API para gerar pagamento PIX via PagBank

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { total, dadosCliente, carrinho, vendaId } = await request.json()

    // Validação
    if (!total || !dadosCliente || !carrinho?.length || !vendaId) {
      console.error('❌ Dados inválidos:', { total, dadosCliente, carrinho: carrinho?.length, vendaId })
      return NextResponse.json(
        { success: false, error: 'Dados inválidos para gerar PIX' },
        { status: 400 }
      )
    }

    const token = process.env.PAGBANK_TOKEN
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    if (!token || !baseUrl) {
      console.error('❌ Variáveis de ambiente ausentes')
      return NextResponse.json(
        { success: false, error: 'Configuração de pagamento ausente' },
        { status: 500 }
      )
    }

    const valorCentavos = Math.round(Number(total) * 100)
    const referenceId = `VENDA-${vendaId}-${Date.now()}`

    console.log('═══════════════════════════════════════')
    console.log('💰 PIX PagBank sendo gerado:')
    console.log('Valor (centavos):', valorCentavos)
    console.log('Cliente:', dadosCliente.nome)
    console.log('Venda ID:', vendaId)
    console.log('Reference ID:', referenceId)
    console.log('Webhook:', `${baseUrl}/api/webhook`)
    console.log('═══════════════════════════════════════')

    // Preparar itens do pedido
    const items = carrinho.map((item: any, index: number) => ({
      reference_id: `ITEM-${index + 1}`,
      name: item.nome || 'Produto',
      quantity: item.qtd || 1,
      unit_amount: Math.round((item.preco || 0) * 100)
    }))

    // Montar body da requisição PagBank
    const pagbankBody = {
      reference_id: referenceId,
      customer: {
        name: dadosCliente.nome,
        email: dadosCliente.email || `${dadosCliente.nome.toLowerCase().replace(/\s/g, '')}@email.com`,
        tax_id: dadosCliente.cpf.replace(/\D/g, ''),
        phones: [
          {
            country: '55',
            area: dadosCliente.telefone ? dadosCliente.telefone.replace(/\D/g, '').substring(0, 2) : '22',
            number: dadosCliente.telefone ? dadosCliente.telefone.replace(/\D/g, '').substring(2) : '999999999',
            type: 'MOBILE'
          }
        ]
      },
      items: items,
      qr_codes: [
        {
          amount: {
            value: valorCentavos
          },
          expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
        }
      ],
      shipping: {
        address: {
          street: dadosCliente.rua || 'Rua Principal',
          number: dadosCliente.numero || 'S/N',
          complement: dadosCliente.complemento || '',
          locality: dadosCliente.bairro || 'Centro',
          city: dadosCliente.cidade || 'Rio das Ostras',
          region_code: dadosCliente.estado || 'RJ',
          country: 'BRA',
          postal_code: dadosCliente.cep ? dadosCliente.cep.replace(/\D/g, '') : '28890000'
        }
      },
      notification_urls: [
        `${baseUrl}/api/webhook`
      ]
    }

    console.log('📤 Enviando para PagBank...')

    const response = await fetch('https://api.pagseguro.com/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-version': '4.0'
      },
      body: JSON.stringify(pagbankBody)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Erro PagBank:', JSON.stringify(data, null, 2))
      return NextResponse.json(
        { success: false, error: 'Erro ao gerar PIX', details: data },
        { status: response.status }
      )
    }

    console.log('✅ PIX PagBank gerado com sucesso!')
    console.log('ID do pedido:', data.id)
    console.log('Reference ID:', data.reference_id)
    console.log('QR Code:', data.qr_codes?.[0]?.text ? 'Presente' : 'Ausente')

    // Extrair dados do QR Code
    const qrCodeData = data.qr_codes?.[0]
    
    if (!qrCodeData?.text) {
      console.error('❌ QR Code não gerado')
      return NextResponse.json(
        { success: false, error: 'QR Code não foi gerado pelo PagBank' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      reference_id: data.reference_id,
      status: data.status,
      qr_code: qrCodeData.text,
      qr_code_base64: qrCodeData.links?.[0]?.href || null,
      expiration_date: qrCodeData.expiration_date,
      amount: qrCodeData.amount.value
    })
  } catch (error: any) {
    console.error('❌ Erro interno:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', message: error.message },
      { status: 500 }
    )
  }
}