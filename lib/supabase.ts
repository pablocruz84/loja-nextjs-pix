import { createClient } from '@supabase/supabase-js'



// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ================================================
// TIPOS
// ================================================

export interface Produto {
  id: number
  codigo: string
  nome: string
  categoria: string
  preco: number
  estoque: number
  unidade: string
  imagem: string
  criado_em?: string
  atualizado_em?: string
}

export interface Cliente {
  id: number
  nome: string
  cpf: string
  telefone: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  ponto_referencia?: string
  total_compras: number
  criado_em?: string
}

export interface Venda {
  id: number
  cliente_id: number
  produtos: any[] // Array de produtos
  total: number
  status: 'pendente' | 'pago' | 'cancelado'
  pix_id?: string
  pix_qr_code?: string
  data_venda: string
  data_pagamento?: string
}

// ================================================
// FUNÇÕES DE PRODUTOS
// ================================================

export async function buscarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('criado_em', { ascending: false })
  
  if (error) throw error
  return data as Produto[]
}

export async function adicionarProduto(produto: Omit<Produto, 'id' | 'criado_em' | 'atualizado_em'>) {
  const { data, error } = await supabase
    .from('produtos')
    .insert([produto])
    .select()
  
  if (error) throw error
  return data[0] as Produto
}

export async function atualizarProduto(id: number, produto: Partial<Produto>) {
  const { data, error } = await supabase
    .from('produtos')
    .update(produto)
    .eq('id', id)
    .select()
  
  if (error) throw error
  return data[0] as Produto
}

export async function deletarProduto(id: number) {
  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ================================================
// FUNÇÕES DE CLIENTES
// ================================================

export async function buscarClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('criado_em', { ascending: false })
  
  if (error) throw error
  return data as Cliente[]
}

export async function buscarClientePorCPF(cpf: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('cpf', cpf)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data as Cliente | null
}

export async function criarCliente(cliente: Omit<Cliente, 'id' | 'total_compras' | 'criado_em'>) {
  const { data, error } = await supabase
    .from('clientes')
    .insert([cliente])
    .select()
  
  if (error) throw error
  return data[0] as Cliente
}

export async function incrementarComprasCliente(clienteId: number) {
  const { error } = await supabase.rpc('incrementar_compras', { cliente_id: clienteId })
  
  if (error) throw error
}

// ================================================
// FUNÇÕES DE VENDAS
// ================================================

export async function buscarVendas() {
  const { data, error } = await supabase
    .from('vendas')
    .select(`
      *,
      clientes (nome, cpf, telefone)
    `)
    .order('data_venda', { ascending: false })
  
  if (error) throw error
  return data
}

export async function criarVenda(venda: Omit<Venda, 'id' | 'data_venda'>) {
  const { data, error } = await supabase
    .from('vendas')
    .insert([venda])
    .select()
  
  if (error) throw error
  return data[0] as Venda
}

export async function atualizarStatusVenda(vendaId: number, status: string, pixId?: string) {
  const updateData: any = { status }
  
  if (status === 'pago') {
    updateData.data_pagamento = new Date().toISOString()
  }
  
  if (pixId) {
    updateData.pix_id = pixId
  }

  const { data, error } = await supabase
    .from('vendas')
    .update(updateData)
    .eq('id', vendaId)
    .select()
  
  if (error) throw error
  return data[0] as Venda
}

// ================================================
// FUNÇÃO AUXILIAR PARA GERAR PRÓXIMO CÓDIGO
// ================================================

export async function gerarProximoCodigo() {
  const { data, error } = await supabase
    .from('produtos')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1)
  
  if (error) throw error
  
  if (!data || data.length === 0) {
    return 'FAC00001'
  }
  
  const ultimoCodigo = data[0].codigo
  const numero = parseInt(ultimoCodigo.replace('FAC', ''))
  const proximoNumero = numero + 1
  
  return `FAC${proximoNumero.toString().padStart(5, '0')}`
}