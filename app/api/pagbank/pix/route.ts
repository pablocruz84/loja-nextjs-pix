import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { total, dadosCliente, carrinho } = await request.json()

    const token = process.env.PAGBANK_TOKEN
    const pixKey = process.env.PAGBANK_PIX_KEY

    if (!token || !pixKey) {
      console.error('❌ Credenciais PagBank não configuradas')
      return NextResponse.json(
        { error: 'Configuração de pagamento ausente' },
        { status: 500 }
      )
    }

    const valorArredondado = (Math.round(total * 100) / 100).toFixed(2)
    const idempotencyKey = randomUUID()

    // ✅ Headers completos para passar pelo Cloudflare
    const response = await fetch("https://api.pagseguro.com/instant-payments/cob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Idempotency-Key": idempotencyKey,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Origin": "https://pagseguro.uol.com.br",
        "Referer": "https://pagseguro.uol.com.br/"
      },
      body: JSON.stringify({
        calendario: {
          expiracao: 3600
        },
        devedor: {
          cpf: dadosCliente.cpf.replace(/\D/g, ''),
          nome: dadosCliente.nome
        },
        valor: {
          original: valorArredondado
        },
        chave: pixKey,
        solicitacaoPagador: `Pedido - ${carrinho.length} itens`
      })
    })

    const responseText = await response.text()

    // Verificar se a resposta é HTML (Cloudflare bloqueou)
    if (responseText.includes('<!DOCTYPE') || responseText.includes('Cloudflare')) {
      console.error('❌ PagBank bloqueado pelo Cloudflare')
      return NextResponse.json(
        { 
          error: 'PagBank temporariamente indisponível',
          details: 'Requisição bloqueada pelo firewall. Use Mercado Pago como alternativa.'
        },
        { status: 503 }
      )
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('❌ Resposta não é JSON:', responseText.substring(0, 200))
      return NextResponse.json(
        { error: 'Erro ao processar resposta do PagBank' },
        { status: 500 }
      )
    }

    if (!response.ok) {
      console.error('❌ Erro PagBank:', data)
      return NextResponse.json(
        { error: 'Erro ao gerar PIX no PagBank', details: data },
        { status: response.status }
      )
    }

    console.log('✅ PIX PagBank gerado:', data.txid)

    return NextResponse.json({
      id: data.txid,
      status: 'pending',
      qr_code: data.pixCopiaECola,
      qr_code_base64: data.qrcode || null,
      ticket_url: null
    })

  } catch (error: any) {
    console.error('❌ Erro na API PagBank:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', message: error.message },
      { status: 500 }
    )
  }
}