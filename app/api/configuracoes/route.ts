// ═══════════════════════════════════════════════════════════
// ARQUIVO: app/api/configuracoes/route.ts
// ═══════════════════════════════════════════════════════════
// API para gerenciar configurações da loja

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// GET - Buscar configurações
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Se não existir, retorna configuração padrão
    if (!data) {
      return NextResponse.json({
        success: true,
        configuracoes: {
          gateway_pagamento: 'mercadopago',
          loja_ativa: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      configuracoes: data
    })
  } catch (error: any) {
    console.error('❌ Erro ao buscar configurações:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Atualizar configurações
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gateway_pagamento, loja_ativa } = body

    console.log('💾 Atualizando configurações:', { gateway_pagamento, loja_ativa })

    // Verificar se já existe configuração
    const { data: existing } = await supabase
      .from('configuracoes')
      .select('id')
      .single()

    let result

    if (existing) {
      // Atualizar existente
      result = await supabase
        .from('configuracoes')
        .update({
          gateway_pagamento,
          loja_ativa,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Criar novo
      result = await supabase
        .from('configuracoes')
        .insert([{
          gateway_pagamento,
          loja_ativa
        }])
        .select()
        .single()
    }

    if (result.error) {
      throw result.error
    }

    console.log('✅ Configurações atualizadas com sucesso')

    return NextResponse.json({
      success: true,
      configuracoes: result.data
    })
  } catch (error: any) {
    console.error('❌ Erro ao atualizar configurações:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}