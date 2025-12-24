import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('📩 Webhook PagBank recebido:', JSON.stringify(body, null, 2))

    // PagBank envia notificações no formato:
    // { "pix": [{ "endToEndId": "...", "txid": "..." }] }
    
    if (body.pix && body.pix.length > 0) {
      const pixData = body.pix[0]
      const txid = pixData.txid

      // ✅ USAR APENAS VARIÁVEL DE AMBIENTE
      const token = process.env.PAGBANK_TOKEN

      if (!token) {
        console.error('❌ PAGBANK_TOKEN não configurado')
        return NextResponse.json({ received: true })
      }

      // Buscar detalhes da cobrança
      const cobResponse = await fetch(`https://api.pagseguro.com/instant-payments/cob/${txid}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      const cobData = await cobResponse.json()

      console.log('💰 Dados da cobrança PagBank:', cobData)

      // Verificar se foi pago
      if (cobData.status === 'CONCLUIDA') {
        // Buscar venda no banco pelo pix_id (txid)
        const { data: vendas, error } = await supabase
          .from('vendas')
          .select('*')
          .eq('pix_id', txid)
          .single()

        if (error || !vendas) {
          console.error('❌ Venda não encontrada para txid:', txid)
          return NextResponse.json({ received: true })
        }

        // Atualizar status da venda
        const { error: updateError } = await supabase
          .from('vendas')
          .update({ 
            status: 'pago',
            data_pagamento: new Date().toISOString()
          })
          .eq('id', vendas.id)

        if (updateError) {
          console.error('❌ Erro ao atualizar venda:', updateError)
        } else {
          console.log('✅ Venda atualizada para PAGO!')
        }
      }
    }

    return NextResponse.json({ received: true })
    
  } catch (error) {
    console.error('❌ Erro no webhook PagBank:', error)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

// PagBank só aceita POST
export async function GET() {
  return NextResponse.json({ message: 'Webhook PagBank ativo' })
}