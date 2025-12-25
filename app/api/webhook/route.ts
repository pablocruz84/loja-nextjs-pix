// app/api/webhook/route.ts - COM DIAGNÓSTICO COMPLETO

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('═══════════════════════════════════════')
    console.log('📩 WEBHOOK RECEBIDO')
    console.log('Body completo:', JSON.stringify(body, null, 2))
    console.log('═══════════════════════════════════════')

    const paymentId = body?.data?.id || body?.id
    
    if (!paymentId) {
      console.log('⚠️ Sem payment ID no body')
      return NextResponse.json({ received: true, error: 'No payment ID' })
    }

    console.log('💳 Payment ID encontrado:', paymentId)

    // Verificar variáveis de ambiente
    const hasToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('🔐 Variáveis de ambiente:')
    console.log('- MERCADOPAGO_ACCESS_TOKEN:', hasToken ? '✅' : '❌')
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', hasSupabaseUrl ? '✅' : '❌')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', hasSupabaseKey ? '✅' : '❌')

    if (!hasToken || !hasSupabaseUrl || !hasSupabaseKey) {
      console.error('❌ Variáveis de ambiente faltando!')
      return NextResponse.json({ 
        received: true, 
        error: 'Missing environment variables' 
      })
    }

    // 🔍 Consulta pagamento no Mercado Pago
    console.log('🔍 Consultando pagamento no Mercado Pago...')
    
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      }
    )

    if (!paymentResponse.ok) {
      console.error('❌ Erro ao consultar Mercado Pago:', paymentResponse.status)
      const errorText = await paymentResponse.text()
      console.error('Resposta:', errorText)
      return NextResponse.json({ received: true, error: 'MP API error' })
    }

    const payment = await paymentResponse.json()
    console.log('💳 Dados do pagamento:')
    console.log('- ID:', payment.id)
    console.log('- Status:', payment.status)
    console.log('- Transaction amount:', payment.transaction_amount)

    if (payment.status !== 'approved') {
      console.log('⏳ Pagamento não aprovado ainda, ignorando...')
      return NextResponse.json({ received: true, status: payment.status })
    }

    console.log('✅ Pagamento aprovado! Buscando venda no banco...')

    // Criar cliente Supabase com SERVICE ROLE KEY
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 🔎 Busca venda
    console.log('🔎 Buscando venda com pix_id:', String(paymentId))
    
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('pix_id', String(paymentId))
      .single()

    if (vendaError) {
      console.error('❌ Erro ao buscar venda:', vendaError)
      console.error('- Code:', vendaError.code)
      console.error('- Message:', vendaError.message)
      console.error('- Details:', vendaError.details)
      return NextResponse.json({ 
        received: true, 
        error: 'Venda não encontrada',
        errorDetails: vendaError 
      })
    }

    if (!venda) {
      console.error('❌ Venda não encontrada para pix_id:', paymentId)
      return NextResponse.json({ 
        received: true, 
        error: 'Venda não existe' 
      })
    }

    console.log('📦 Venda encontrada:')
    console.log('- ID:', venda.id)
    console.log('- Status atual:', venda.status)
    console.log('- Total:', venda.total)

    // 🛑 Evita duplicidade
    if (venda.status === 'pago') {
      console.log('✅ Venda já está marcada como paga, ignorando...')
      return NextResponse.json({ 
        received: true, 
        alreadyPaid: true,
        vendaId: venda.id 
      })
    }

    // ✅ Atualiza venda para PAGO
    console.log('💾 Atualizando venda para PAGO...')
    
    const { data: vendaAtualizada, error: updateError } = await supabase
      .from('vendas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString()
      })
      .eq('id', venda.id)
      .select()

    if (updateError) {
      console.error('❌ Erro ao atualizar venda:', updateError)
      console.error('- Code:', updateError.code)
      console.error('- Message:', updateError.message)
      console.error('- Details:', updateError.details)
      return NextResponse.json({ 
        received: true, 
        error: 'Erro ao atualizar',
        errorDetails: updateError 
      })
    }

    console.log('✅ Venda atualizada com sucesso!')
    console.log('Dados atualizados:', vendaAtualizada)
    console.log('═══════════════════════════════════════')

    return NextResponse.json({ 
      received: true,
      updated: true,
      vendaId: venda.id,
      newStatus: 'pago'
    })

  } catch (error: any) {
    console.error('═══════════════════════════════════════')
    console.error('❌ ERRO FATAL NO WEBHOOK')
    console.error('Tipo:', error.constructor.name)
    console.error('Mensagem:', error.message)
    console.error('Stack:', error.stack)
    console.error('═══════════════════════════════════════')
    
    return NextResponse.json({ 
      received: true,
      error: error.message,
      errorType: error.constructor.name
    })
  }
}

export async function GET() {
  const hasToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  return NextResponse.json({ 
    message: 'Webhook Mercado Pago ativo',
    timestamp: new Date().toISOString(),
    environment: {
      MERCADOPAGO_ACCESS_TOKEN: hasToken ? 'Configurado ✅' : 'Faltando ❌',
      NEXT_PUBLIC_SUPABASE_URL: hasSupabaseUrl ? 'Configurado ✅' : 'Faltando ❌',
      SUPABASE_SERVICE_ROLE_KEY: hasSupabaseKey ? 'Configurado ✅' : 'Faltando ❌'
    }
  })
}