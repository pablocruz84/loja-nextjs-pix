'use client'

import { useState, useEffect } from 'react'
import {
  buscarProdutos,
  buscarClientePorCPF,
  criarCliente,
  criarVenda
} from '@/lib/supabase'

// 🎭 FUNÇÕES DE MÁSCARA
const formatarCPF = (valor: string) => {
  const numeros = valor.replace(/\D/g, '')
  return numeros
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const formatarTelefone = (valor: string) => {
  const numeros = valor.replace(/\D/g, '')
  return numeros
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1)$2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

// 📦 INTERFACE PRODUTO
interface Produto {
  id: number
  nome: string
  categoria: string
  preco: number
  estoque: number
  imagem: string
  unidade?: string
}

export default function Home() {
  // =========================
  // ESTADOS
  // =========================
  const [etapa, setEtapa] = useState(1)
  const [carrinho, setCarrinho] = useState<(Produto & { qtd: number })[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')

  const [dadosCliente, setDadosCliente] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    rua: '',
    numero: '',
    bairro: 'Cantagalo',
    cidade: 'Rio das Ostras',
    estado: 'RJ',
    pontoReferencia: ''
  })

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(true)

  const [mostrarToast, setMostrarToast] = useState(false)
  const [mensagemToast, setMensagemToast] = useState('')
  const [botaoClicado, setBotaoClicado] = useState<number | null>(null)

  const [pixGerado, setPixGerado] = useState<any>(null)
  const [carregandoPix, setCarregandoPix] = useState(false)

  const [vendaId, setVendaId] = useState<number | null>(null)
  const [statusPagamento, setStatusPagamento] =
    useState<'pendente' | 'aprovado'>('pendente')

  const TAXA_ENTREGA = 0

  // =========================
  // CÁLCULOS
  // =========================
  const subtotal = carrinho.reduce(
    (sum, item) => sum + item.preco * item.qtd,
    0
  )

  const total = subtotal + TAXA_ENTREGA

  // =========================
  // FILTROS
  // =========================
  const categorias = ['Todos', ...new Set(produtos.map(p => p.categoria))]
  const produtosFiltrados =
    categoriaFiltro === 'Todos'
      ? produtos
      : produtos.filter(p => p.categoria === categoriaFiltro)

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => {
    carregarProdutos()
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('carrinho')
    if (saved) setCarrinho(JSON.parse(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem('carrinho', JSON.stringify(carrinho))
  }, [carrinho])

  useEffect(() => {
    if (!mostrarToast) return
    const t = setTimeout(() => setMostrarToast(false), 3000)
    return () => clearTimeout(t)
  }, [mostrarToast])

  // 🔄 POLLING PIX
  useEffect(() => {
    if (!vendaId || statusPagamento === 'aprovado') return

    const intervalo = setInterval(async () => {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data } = await supabase
        .from('vendas')
        .select('status')
        .eq('id', vendaId)
        .single()

    if (data && (data.status === 'pago' || data.status === 'approved')) {
      console.log('✅ PAGAMENTO CONFIRMADO!')
      setStatusPagamento('aprovado')
      clearInterval(intervalo)
      }
    }, 5000)

    return () => clearInterval(intervalo)
  }, [vendaId, statusPagamento])

  // =========================
  // FUNÇÕES
  // =========================
  const carregarProdutos = async () => {
    try {
      setCarregandoProdutos(true)
      setProdutos(await buscarProdutos())
    } finally {
      setCarregandoProdutos(false)
    }
  }

  const adicionarAoCarrinho = (produto: Produto) => {
    setBotaoClicado(produto.id)
    setTimeout(() => setBotaoClicado(null), 150)

    const existe = carrinho.find(i => i.id === produto.id)
    setCarrinho(
      existe
        ? carrinho.map(i =>
            i.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i
          )
        : [...carrinho, { ...produto, qtd: 1 }]
    )

    setMensagemToast('✓ Adicionado ao carrinho!')
    setMostrarToast(true)
  }

  const atualizarQtd = (id: number, qtd: number) => {
    if (qtd <= 0) {
      setCarrinho(carrinho.filter(item => item.id !== id))
    } else {
      setCarrinho(
        carrinho.map(item =>
          item.id === id ? { ...item, qtd } : item
        )
      )
    }
  }

  const removerItem = (id: number) => {
    setCarrinho(carrinho.filter(item => item.id !== id))
  }


  const gerarPix = async () => {
    setCarregandoPix(true)
    setEtapa(5)

    try {
      let cliente = await buscarClientePorCPF(dadosCliente.cpf)
      if (!cliente) cliente = await criarCliente(dadosCliente)

      const response = await fetch('/api/mercadopago/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total, carrinho, dadosCliente })
      })

      const pixData = await response.json()

      const venda = await criarVenda({
        cliente_id: cliente.id,
        produtos: carrinho,
        total,
        status: 'pendente',
        pix_id: pixData.id,
        pix_qr_code: pixData.qr_code
      })

      setVendaId(venda.id)
      setPixGerado(pixData)
    } finally {
      setCarregandoPix(false)
    }
  }


  // Renderização das etapas
  const renderSteps = () => (
    <section className="bg-gray-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Step 1 - Produtos */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mb-1 transition-all ${
              etapa >= 1 ? 'bg-orange-500' : 'bg-gray-200'
            }`}>
              <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ${etapa >= 1 ? 'text-white' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold ${etapa >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>
              Produtos
            </span>
          </div>

          <div className="flex-1 h-px bg-gray-300 mt-[-10px]"></div>

          {/* Step 2 - Dados */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mb-1 transition-all ${
              etapa >= 3 ? 'bg-orange-500' : 'bg-gray-200'
            }`}>
              <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ${etapa >= 3 ? 'text-white' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold ${etapa >= 3 ? 'text-gray-900' : 'text-gray-400'}`}>
              Dados
            </span>
          </div>

          <div className="flex-1 h-px bg-gray-300 mt-[-10px]"></div>

          {/* Step 3 - Confirmação */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mb-1 transition-all ${
              etapa >= 4 ? 'bg-orange-500' : 'bg-gray-200'
            }`}>
              <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ${etapa >= 4 ? 'text-white' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
              </svg>
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold ${etapa >= 4 ? 'text-gray-900' : 'text-gray-400'}`}>
              Confirmar
            </span>
          </div>
        </div>
      </div>
    </section>
  )

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0d4a76] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          
          {/* LOGO */}
          <div className="flex items-center">
            <img 
              src="/logo-facil.png" 
              alt="Fácil Material de Construção e Bazar" 
              className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto cursor-pointer hover:opacity-90 transition"
              onClick={() => setEtapa(1)}
            />
          </div>

          {/* CARRINHO */}
          <button
            onClick={() => carrinho.length > 0 && setEtapa(2)}
            className="relative flex items-center gap-2 bg-white text-[#2d3e50] px-3 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-md hover:shadow-lg transition-all hover:scale-105"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="w-5 h-5 sm:w-6 sm:h-6"
            >
              <circle cx="8" cy="21" r="1"/>
              <circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
            </svg>
            <span className="font-bold text-sm sm:text-base hidden sm:inline">Carrinho</span>
            
            {carrinho.length > 0 && (
              <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-orange-500 text-white text-xs sm:text-sm font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full min-w-[22px] sm:min-w-[28px] text-center shadow-md">
                {carrinho.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* STEPS */}
      {renderSteps()}

      {/* ETAPA 1: PRODUTOS */}
      {etapa === 1 && (
        <main className="bg-gray-100 flex-1">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-6 sm:pb-8">
            {/* Categorias */}
            <div className="flex gap-2 sm:gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide py-3">
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full font-semibold text-xs sm:text-sm shrink-0 capitalize transition-colors ${
                    categoriaFiltro === cat
                      ? 'bg-orange-500 text-white shadow'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid de produtos */}
            {carregandoProdutos ? (
              <div className="text-center py-16 sm:py-20">
                <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-orange-500 border-t-transparent"></div>
                <p className="text-lg sm:text-xl text-gray-600 mt-4">Carregando produtos...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="text-center py-16 sm:py-20">
                <p className="text-lg sm:text-xl text-gray-600">Nenhum produto disponível.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-4">
                {produtosFiltrados.map(produto => (
                  <div key={produto.id} className="bg-white rounded-xl sm:rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all flex flex-col">

                    {/* IMAGEM DO PRODUTO */}
                    <div
                      className="relative bg-gray-50 p-2 sm:p-4 flex items-center justify-center"
                      style={{ height: '160px' }}
                    >
                      <img 
                        src={produto.imagem} 
                        alt={produto.nome} 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>

                    {/* INFORMAÇÕES */}
                    <div className="p-3 sm:p-4 flex flex-col flex-1">
                      {/* BADGE CATEGORIA */}
                      <div className="mb-1.5 sm:mb-2">
                        <span className="inline-block bg-[#0d4a76] text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase">
                          {produto.categoria}
                        </span>
                      </div>
                      
                      {/* NOME DO PRODUTO */}
                      <h3 className="font-bold text-sm sm:text-base md:text-lg text-gray-900 mb-1.5 sm:mb-2 leading-tight line-clamp-2">
                        {produto.nome}
                      </h3>
                      
                      {/* ESTOQUE - Oculto em mobile muito pequeno */}
                      <p className="hidden sm:block text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                        Estoque: {produto.estoque} {produto.unidade || 'unidades'}
                      </p>
                      
                      {/* PREÇO E BOTÃO */}
                      <div className="mt-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2 sm:gap-3">
                        {/* PREÇO */}
                        <div className="flex-shrink-0">
                          <span className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 block leading-none">
                            R$ {produto.preco.toFixed(2).replace('.', ',')}
                          </span>
                          {produto.unidade && <span className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">por {produto.unidade}</span>}
                        </div>
                        
                        {/* BOTÃO ADICIONAR */}
                        <button
                          onClick={() => adicionarAoCarrinho(produto)}
                          className={`w-full sm:w-auto flex-shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-1000 flex items-center justify-center gap-1.5 sm:gap-2 ${
                            botaoClicado === produto.id 
                              ? 'bg-[#0d4a76] text-white' 
                              : 'bg-orange-500 text-white hover:bg-orange-600'
                          }`}
                        >
                          {botaoClicado === produto.id ? (
                            <>
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                              </svg>
                              <span>Adicionado</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                              </svg>
                              <span>Adicionar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ETAPA 2: CARRINHO */}
      {etapa === 2 && (
        <main className="bg-gray-100 py-4 sm:py-6 flex-1">
          <div className="max-w-2xl mx-auto px-3 sm:px-4">
            <div className="bg-[#0d4a76] text-white rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 flex justify-center items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="8" cy="21" r="1"/>
                <circle cx="19" cy="21" r="1"/>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
              </svg>
              <h2 className="text-xl sm:text-2xl font-bold">Carrinho</h2>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
              {carrinho.length === 0 ? (
                // CARRINHO VAZIO
                <div className="text-center py-12 sm:py-16">
                  <svg className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="8" cy="21" r="1"/>
                    <circle cx="19" cy="21" r="1"/>
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                  </svg>
                  <p className="text-gray-600 text-base sm:text-lg mb-6 sm:mb-8">Seu carrinho está vazio.</p>
                  <button
                    onClick={() => setEtapa(1)}
                    className="bg-gray-200 text-gray-700 px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-300 text-sm sm:text-base"
                  >
                    ← Continuar Comprando
                  </button>
                </div>
              ) : (
                // CARRINHO COM ITENS
                <>
                  {carrinho.map((item) => (
                    <div key={item.id} className="pb-3 sm:pb-4 mb-3 sm:mb-4 border-b">
                      <h3 className="font-bold text-sm sm:text-base text-gray-800 mb-1">{item.nome}</h3>
                      <p className="text-gray-600 text-xs sm:text-sm mb-1.5 sm:mb-2">{item.unidade}</p>
                      <p className="text-orange-500 font-bold text-xs sm:text-sm mb-2 sm:mb-3">
                        R$ {item.preco.toFixed(2)} un.
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button 
                            onClick={() => atualizarQtd(item.id, item.qtd - 1)} 
                            className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 rounded-full font-bold text-base sm:text-lg flex items-center justify-center hover:bg-gray-300"
                          >
                            −
                          </button>
                          <span className="w-6 sm:w-8 text-center font-bold text-sm sm:text-base">{item.qtd}</span>
                          <button 
                            onClick={() => atualizarQtd(item.id, item.qtd + 1)} 
                            className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-500 text-white rounded-full font-bold text-base sm:text-lg flex items-center justify-center hover:bg-orange-600"
                          >
                            +
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-right">
                            <p className="text-[10px] sm:text-xs text-gray-600">Subtotal</p>
                            <p className="font-bold text-base sm:text-lg">R$ {(item.qtd * item.preco).toFixed(2)}</p>
                          </div>
                          <button 
                            onClick={() => removerItem(item.id)} 
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-3 sm:pt-4">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                      <span className="text-base sm:text-lg font-bold">Total do Pedido:</span>
                      <span className="text-2xl sm:text-3xl font-bold text-orange-500">R$ {total.toFixed(2)}</span>
                    </div>
                    
                    <button 
                      onClick={() => setEtapa(1)} 
                      className="w-full mb-2 sm:mb-3 bg-gray-200 text-gray-700 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-300 text-sm sm:text-base"
                    >
                      ← Continuar Comprando
                    </button>
                    
                    <button 
                      onClick={() => setEtapa(3)} 
                      className="w-full bg-[#0d4a76] text-white py-2.5 sm:py-3 rounded-lg font-bold hover:bg-[#0b3f65] transition-colors duration-200 text-sm sm:text-base"
                    >
                      Prosseguir para Dados →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ETAPA 3: DADOS */}
      {etapa === 3 && (
        <main className="bg-gray-100 py-4 sm:py-6 flex-1">
          <div className="max-w-2xl mx-auto px-3 sm:px-4">
            <div className="bg-[#0d4a76] text-white rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 flex justify-center items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <h2 className="text-xl sm:text-2xl font-bold">Dados para Entrega</h2>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    value={dadosCliente.nome}
                    onChange={(e) => setDadosCliente({...dadosCliente, nome: e.target.value})}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                    placeholder="Digite seu nome completo"
                  />
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">CPF *</label>
                  <input
                    type="text"
                    value={dadosCliente.cpf}
                    onChange={(e) => setDadosCliente({...dadosCliente, cpf: formatarCPF(e.target.value)})}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="tel"
                    value={dadosCliente.telefone}
                    onChange={(e) => setDadosCliente({...dadosCliente, telefone: formatarTelefone(e.target.value)})}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                    placeholder="(22) 99999-9999"
                    maxLength={14}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={dadosCliente.cidade}
                      disabled
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={dadosCliente.bairro}
                      disabled
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Rua *</label>
                    <input
                      type="text"
                      value={dadosCliente.rua}
                      onChange={(e) => setDadosCliente({...dadosCliente, rua: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                      placeholder="Nome da rua"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Número *</label>
                    <input
                      type="text"
                      value={dadosCliente.numero}
                      onChange={(e) => setDadosCliente({...dadosCliente, numero: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                      placeholder="123"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Ponto de Referência</label>
                  <textarea
                    value={dadosCliente.pontoReferencia}
                    onChange={(e) => setDadosCliente({...dadosCliente, pontoReferencia: e.target.value})}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none resize-none"
                    rows={3}
                    placeholder="Ex: Próximo ao supermercado..."
                  />
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button 
                  onClick={() => setEtapa(2)} 
                  className="w-full bg-gray-200 text-gray-700 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-300"
                >
                  ← Voltar
                </button>
                <button 
                  onClick={() => setEtapa(4)}
                  disabled={!dadosCliente.nome || !dadosCliente.telefone || !dadosCliente.rua || !dadosCliente.numero}
                  className="w-full bg-[#0d4a76] text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold hover:bg-[#0b3f65] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar →
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

          {/* ETAPA 4: CONFIRMAÇÃO */}
    {etapa === 4 && (
      <main className="bg-gray-100 py-4 sm:py-6 flex-1">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center justify-center mx-auto mb-4 sm:mb-6">Confirme seu Pedido</h2>

            {/* PRODUTOS */}
            <div className="mb-4 sm:mb-6">
              <h3 className="font-bold text-sm sm:text-base text-gray-800 mb-2 sm:mb-3 flex items-center gap-2">
                📦 Produtos
              </h3>
              {carrinho.map(item => (
                <div key={item.id} className="flex justify-between items-center py-1.5 sm:py-2 text-xs sm:text-sm">
                  <span className="text-gray-700">{item.qtd}x {item.nome}</span>
                  <span className="font-semibold">R$ {(item.qtd * item.preco).toFixed(2)}</span>
                </div>
              ))}
              
              {/* SUBTOTAL */}
              <div className="border-t pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 flex justify-between items-center text-xs sm:text-sm text-gray-700">
                <span>Subtotal:</span>
                <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
              </div>
              
              {/* TAXA DE ENTREGA */}
              <div className="flex justify-between items-center py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700">
                <span>Taxa de Entrega:</span>
                <span className="font-semibold">R$ {TAXA_ENTREGA.toFixed(2)}</span>
              </div>
              
              {/* LINHA DIVISÓRIA */}
              <div className="border-t border-gray-300 my-1.5 sm:my-2"></div>
              
              {/* TOTAL */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-base sm:text-lg">Total:</span>
                <span className="text-xl sm:text-2xl font-bold text-orange-500">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* ENTREGA */}
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="font-bold text-sm sm:text-base text-gray-800 mb-2 sm:mb-3 flex items-center gap-2">
                🏠 Entrega
              </h3>
              <div className="text-xs sm:text-sm text-gray-700 space-y-0.5 sm:space-y-1">
                <p><strong>Nome:</strong> {dadosCliente.nome}</p>
                <p><strong>CPF:</strong> {dadosCliente.cpf}</p>
                <p><strong>Telefone:</strong> {dadosCliente.telefone}</p>
                <p><strong>Endereço:</strong> {dadosCliente.rua}, {dadosCliente.numero}</p>
                <p><strong>Bairro:</strong> {dadosCliente.bairro}</p>
                <p><strong>Cidade:</strong> {dadosCliente.cidade} - {dadosCliente.estado}</p>
                {dadosCliente.pontoReferencia && (
                  <p><strong>Ponto de Ref.:</strong> {dadosCliente.pontoReferencia}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button 
                onClick={() => setEtapa(3)} 
                className="w-full bg-gray-200 text-gray-700 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-300 transition-colors"
              >
                ← Voltar
              </button>
              <button 
                onClick={gerarPix}
                className="w-full bg-[#0d4a76] text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold hover:bg-[#0b3f65] flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C257.1 224.3 247.8 224.3 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.8C231.1-7.6 280.3-7.6 310.6 22.8L407.8 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.6L149.7 353.3C139.1 363.1 126.4 368.7 112.6 368.7H80.78L22.8 310.6C-7.6 280.3-7.6 231.1 22.8 200.8L80.78 142.8H112.6z"></path>
                </svg>
                <span className="hidden sm:inline">Pagar com PIX</span>
                <span className="sm:hidden">PIX</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    )}

    {/* ETAPA 5: PAGAMENTO PIX */}
    {etapa === 5 && (
      <main className="bg-gray-100 py-4 sm:py-6 flex-1">
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-md overflow-hidden">

            {/* HEADER */}
            <div className="bg-[#0d4a76] text-white py-4 sm:py-5 text-center">
              <h2 className="text-lg sm:text-xl font-bold flex items-center justify-center gap-2">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                </svg> Pagamento PIX
              </h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

              {/* DADOS DO CLIENTE */}
              <div>
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Dados do Cliente</h3>
                <div className="text-xs sm:text-sm text-gray-700 space-y-1.5 sm:space-y-2">
                  <p><b>Nome:</b> {dadosCliente.nome}</p>
                  <p><b>CPF:</b> {dadosCliente.cpf}</p>
                  <p><b>Telefone:</b> {dadosCliente.telefone}</p>
                  <p><b>Endereço:</b> {dadosCliente.rua}, {dadosCliente.numero}</p>
                  <p><b>Bairro:</b> {dadosCliente.bairro}</p>
                  <p><b>Cidade:</b> {dadosCliente.cidade} - {dadosCliente.estado}</p>
                </div>
              </div>

              {/* PRODUTOS */}
              <div>
                <h3 className="font-bold text-base sm:text-lg mb-2">Produtos</h3>
                {carrinho.map((item, index) => (
                  <div key={index} className="flex justify-between text-xs sm:text-sm border-b py-1.5 sm:py-2">
                    <span>{item.qtd}x {item.nome}</span>
                    <span className="font-semibold">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                  </div>
                ))}
                
                {/* SUBTOTAL */}
                <div className="flex justify-between text-xs sm:text-sm py-1.5 sm:py-2 text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
                </div>
                
                {/* TAXA DE ENTREGA */}
                <div className="flex justify-between text-xs sm:text-sm py-1.5 sm:py-2 text-gray-700">
                  <span>Taxa de Entrega:</span>
                  <span className="font-semibold">R$ {TAXA_ENTREGA.toFixed(2)}</span>
                </div>
                
                {/* LINHA DIVISÓRIA */}
                <div className="border-t border-gray-300 my-1.5 sm:my-2"></div>
                
                {/* TOTAL */}
                <div className="flex justify-between text-base sm:text-lg font-bold mt-2 sm:mt-3">
                  <span>Total do Pedido</span>
                  <span className="text-orange-500">R$ {total.toFixed(2)}</span>
                </div>
              </div>

              {/* BLOCO PIX */}
              {carregandoPix ? (
                <div className="bg-green-50 rounded-lg p-6 sm:p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-4 border-green-600 mx-auto mb-3 sm:mb-4"></div>
                  <p className="font-semibold text-sm sm:text-base text-gray-700">Gerando pagamento PIX...</p>
                </div>
              ) : pixGerado && (
                <div className="bg-green-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6">
                  <h3 className="font-bold text-green-700 text-base sm:text-lg">Pagamento via PIX</h3>

                  {/* GRID PIX */}
                  <div className="grid md:grid-cols-2 gap-4 sm:gap-6">

                    {/* QR CODE */}
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-center">
                      {pixGerado.qr_code_base64 && (
                        <img
                          src={`data:image/png;base64,${pixGerado.qr_code_base64}`}
                          alt="QR Code PIX"
                          className="mx-auto w-44 h-44 sm:w-56 sm:h-56"
                        />
                      )}
                      <p className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3">Escaneie com o app do seu banco</p>
                    </div>

                    {/* INFO */}
                    <div className="space-y-3 sm:space-y-4">

                      {/* COPIAR */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pixGerado.qr_code)
                          setMensagemToast('✓ Código PIX copiado!')
                          setMostrarToast(true)
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 sm:py-4 rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z" />
                        </svg> Copiar Código PIX
                      </button>

                      {/* VALOR */}
                      <div className="bg-green-100 rounded-xl p-3 sm:p-4 text-center">
                        <p className="text-xs sm:text-sm text-gray-600">Valor a pagar</p>
                        <p className="text-2xl sm:text-3xl font-bold text-green-700">R$ {total.toFixed(2)}</p>
                      </div>

                      {/* PASSOS */}
                      <ol className="text-xs sm:text-sm text-gray-700 space-y-0.5 sm:space-y-1">
                        <li>1. Abra o app do seu banco</li>
                        <li>2. Escaneie o QR Code ou copie o código</li>
                        <li>3. Confirme o pagamento</li>
                        <li>4. Aguarde a confirmação</li>
                      </ol>

                    </div>
                  </div>

                  {/* AGUARDANDO */}
                  <div className="bg-yellow-100 border-l-4 border-yellow-500 rounded-lg p-3 sm:p-4 font-semibold text-xs sm:text-sm text-yellow-800 flex items-center gap-2 sm:gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-yellow-600" />
                    <span>Aguardando confirmação do pagamento...</span>
                  </div>
                  

                  {/* COMO PROCEDER */}
                  <div className="bg-blue-100 border-l-4 border-blue-500 rounded-lg p-3 sm:p-4">
                    <h4 className="font-bold text-xs sm:text-sm text-blue-800 mb-1.5 sm:mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                      </svg>
                      Como proceder
                    </h4>
                    <ol className="text-xs sm:text-sm text-blue-900 list-decimal list-inside space-y-0.5 sm:space-y-1">
                      <li>Realize o pagamento via PIX</li>
                      <li>Aguarde a confirmação automática</li>
                      <li>Após confirmado, o pedido será enviado para a loja</li>
                    </ol>
                  </div>

                  {/* ID */}
                  <p className="text-[10px] sm:text-xs text-center text-gray-500">
                    ID do Pagamento: <span className="font-mono font-bold">{pixGerado.id}</span>
                  </p>

                  {/* CANCELAR */}
                  <button
                    onClick={() => {
                      setCarrinho([])
                      setEtapa(1)
                      setPixGerado(null)
                    }}
                    className="w-full bg-gray-200 hover:bg-gray-300 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-colors"
                  >
                    Cancelar
                  </button>

                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    )}

    {/* 🎯 TOAST DE NOTIFICAÇÃO */}
    {mostrarToast && (
      <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down px-3">
        <div className="bg-[#0d4a76] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-2xl flex items-center gap-2 sm:gap-3 border-2 border-white/20 max-w-md">
          <span className="font-semibold text-xs sm:text-sm">{mensagemToast}</span>
        </div>
      </div>
    )}

    {/* FOOTER */}
    <footer className="bg-[#0d4a76] text-white mt-auto w-full">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col items-center gap-2 text-center">
        <h3 className="text-sm md:text-base font-bold">
          Fácil Material de Construção e Bazar
        </h3>
        
        <div className="text-xs text-gray-300 space-y-0.5">
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 fill-gray-300 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>Estrada Professor Leandro Farias Sarzedas</span>
          </div>
          <span>Cantagalo Rio das Ostras - RJ</span>
        </div>
        
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-300">
          <svg className="w-3.5 h-3.5 fill-gray-300 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          <span>(22) 99913-1594</span>
        </div>
        
        <div className="w-full max-w-xs h-px bg-white/20 my-1"></div>
        
        <p className="text-xs text-gray-300">
          © 2025 – Todos os direitos reservados
        </p>
      </div>
    </footer>
    </div>
  )
}