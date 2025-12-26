// app/api/confirmar-pagamento/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { vendaId } = await request.json()

    if (!vendaId) {
      return NextResponse.json({ error: 'vendaId obrigatório' }, { status: 400 })
    }

    console.log('🧪 Confirmação manual de pagamento')
    console.log('Venda ID:', vendaId)

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar venda
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', vendaId)
      .single()

    if (vendaError || !venda) {
      console.error('❌ Venda não encontrada:', vendaError)
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    console.log('📦 Venda encontrada:', venda.id)
    console.log('Status atual:', venda.status)

    if (venda.status === 'pago') {
      console.log('✅ Venda já está paga')
      return NextResponse.json({ 
        success: true, 
        message: 'Venda já está paga',
        vendaId: venda.id 
      })
    }

    // Atualizar para pago
    const { error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString()
      })
      .eq('id', vendaId)

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar venda' }, { status: 500 })
    }

    console.log('✅ Venda atualizada para PAGO!')
    console.log('🔔 Polling detectará em até 5 segundos')

    return NextResponse.json({ 
      success: true,
      message: 'Pagamento confirmado com sucesso',
      vendaId: venda.id
    })

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}