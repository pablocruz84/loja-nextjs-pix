'use client'

import { useState, useEffect } from 'react'
import { buscarProdutos, buscarClientePorCPF, criarCliente, criarVenda, atualizarStatusVenda, Produto as ProdutoDB, supabase } from '@/lib/supabase'

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
    cep: '',
    complemento: '',
    ponto_referencia: ''
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

  // =========================
  // FUNÇÕES
  // =========================
  
  // 📧 Função para enviar pedido por email
  const enviarPedidoPorEmail = async () => {
    if (!vendaId) return
    
    try {
      console.log('📧 Enviando pedido por email...')
      
      const dados = {
        pedidoId: `#${String(vendaId).padStart(6, '0')}`,
        data: new Date().toLocaleDateString('pt-BR'),
        cliente: dadosCliente,
        itens: carrinho,
        subtotal,
        taxaEntrega: TAXA_ENTREGA,
        total
      }
      
      try {
        const { gerarPedidoPDF, pdfParaBase64 } = await import('@/lib/gerarPedidoPDF')
        const pdf = gerarPedidoPDF(dados)
        const pdfBase64 = pdfParaBase64(pdf)
        
        const response = await fetch('/api/enviar-pedido', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedidoId: dados.pedidoId,
            nomeCliente: dadosCliente.nome,
            pdfBase64
          })
        })
        
        if (response.ok) {
          console.log('✅ Email enviado com sucesso!')
        } else {
          console.warn('⚠️ Erro ao enviar email')
        }
      } catch (error) {
        console.warn('⚠️ Erro ao gerar/enviar PDF:', error)
      }
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error)
    }
  }

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

  // 🔄 POLLING: Verificar pagamento no Supabase (atualizado pelo webhook PagBank)
  useEffect(() => {
    if (!vendaId || !pixGerado || statusPagamento === 'aprovado') return

    console.log('🔄 Iniciando verificação de pagamento para venda:', vendaId)
    console.log('📦 PagBank Order ID:', pixGerado.id)

    const intervalo = setInterval(async () => {
      try {
        console.log('⏱️ Verificando pagamento no Supabase...')

        // Consulta a venda no Supabase para ver se o webhook já atualizou
        const { data: venda, error } = await supabase
          .from('vendas')
          .select('status, data_pagamento')
          .eq('id', vendaId)
          .single()

        if (error) {
          console.error('❌ Erro ao consultar venda:', error)
          return
        }

        console.log('🔍 Status da venda:', venda.status)

        if (venda.status === 'pago') {
          console.log('✅ PAGAMENTO CONFIRMADO!')
          setStatusPagamento('aprovado')
          
          // Enviar email
          enviarPedidoPorEmail().catch(err => {
            console.error('Erro ao enviar email:', err)
          })

          clearInterval(intervalo)
        }
      } catch (error) {
        console.error('❌ Erro na verificação:', error)
      }
    }, 5000) // Verifica a cada 5 segundos

    // Limpar após 15 minutos
    const timeout = setTimeout(() => {
      clearInterval(intervalo)
      console.log('⏰ Timeout: Verificação interrompida após 15 minutos')
    }, 900000)

    return () => {
      clearInterval(intervalo)
      clearTimeout(timeout)
    }
  }, [vendaId, pixGerado, statusPagamento])

  // =========================
  // CARREGAR PRODUTOS
  // =========================
  const carregarProdutos = async () => {
    try {
      const produtosDB = await buscarProdutos()
      const produtosFormatados = produtosDB.map((p: ProdutoDB) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        preco: p.preco,
        estoque: p.estoque,
        imagem: p.imagem_url || '/placeholder.png',
        unidade: p.unidade_medida || 'un'
      }))
      setProdutos(produtosFormatados)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setCarregandoProdutos(false)
    }
  }

  // =========================
  // CARRINHO
  // =========================
  const adicionarAoCarrinho = (produto: Produto) => {
    const existe = carrinho.find(item => item.id === produto.id)

    if (existe) {
      setCarrinho(
        carrinho.map(item =>
          item.id === produto.id ? { ...item, qtd: item.qtd + 1 } : item
        )
      )
    } else {
      setCarrinho([...carrinho, { ...produto, qtd: 1 }])
    }

    setMensagemToast('✓ Produto adicionado')
    setMostrarToast(true)

    setBotaoClicado(produto.id)
    setTimeout(() => setBotaoClicado(null), 300)
  }

  const alterarQuantidade = (id: number, qtd: number) => {
    if (qtd === 0) {
      setCarrinho(carrinho.filter(item => item.id !== id))
    } else {
      setCarrinho(
        carrinho.map(item => (item.id === id ? { ...item, qtd } : item))
      )
    }
  }

  // =========================
  // BUSCAR CLIENTE POR CPF
  // =========================
  const buscarCliente = async () => {
    if (!dadosCliente.cpf || dadosCliente.cpf.length < 14) return

    try {
      const cpfLimpo = dadosCliente.cpf.replace(/\D/g, '')
      const cliente = await buscarClientePorCPF(cpfLimpo)

      if (cliente) {
        setDadosCliente({
          nome: cliente.nome,
          cpf: dadosCliente.cpf,
          telefone: cliente.telefone || '',
          rua: cliente.endereco || '',
          numero: cliente.numero || '',
          bairro: cliente.bairro || 'Cantagalo',
          cidade: cliente.cidade || 'Rio das Ostras',
          estado: cliente.estado || 'RJ',
          cep: cliente.cep || '',
          complemento: cliente.complemento || '',
          ponto_referencia: cliente.ponto_referencia || ''
        })

        setMensagemToast('✓ Cliente encontrado')
        setMostrarToast(true)
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error)
    }
  }

  // =========================
  // FINALIZAR PEDIDO
  // =========================
  const finalizarPedido = async () => {
    if (carrinho.length === 0) {
      alert('Carrinho vazio!')
      return
    }

    if (!dadosCliente.nome || !dadosCliente.cpf) {
      alert('Preencha os dados do cliente!')
      return
    }

    setCarregandoPix(true)

    try {
      console.log('═══════════════════════════════════════')
      console.log('🛒 INICIANDO PROCESSO DE VENDA')

      // 1️⃣ REGISTRAR VENDA NO SUPABASE
      console.log('1️⃣ Registrando venda no Supabase...')
      const venda = await criarVenda({
        cliente_nome: dadosCliente.nome,
        cliente_cpf: dadosCliente.cpf.replace(/\D/g, ''),
        cliente_telefone: dadosCliente.telefone.replace(/\D/g, ''),
        cliente_endereco: dadosCliente.rua,
        cliente_numero: dadosCliente.numero,
        cliente_bairro: dadosCliente.bairro,
        cliente_cidade: dadosCliente.cidade,
        cliente_estado: dadosCliente.estado,
        cliente_cep: dadosCliente.cep.replace(/\D/g, ''),
        cliente_complemento: dadosCliente.complemento,
        total: total,
        status: 'pendente',
        itens: carrinho.map(item => ({
          produto_id: item.id,
          nome: item.nome,
          quantidade: item.qtd,
          preco: item.preco
        }))
      })

      if (!venda || !venda.id) {
        throw new Error('Erro ao criar venda no banco')
      }

      setVendaId(venda.id)
      console.log('✅ Venda registrada com ID:', venda.id)

      // 2️⃣ CRIAR CLIENTE SE NÃO EXISTIR
      console.log('2️⃣ Verificando/criando cliente...')
      try {
        await criarCliente({
          nome: dadosCliente.nome,
          cpf: dadosCliente.cpf.replace(/\D/g, ''),
          telefone: dadosCliente.telefone.replace(/\D/g, ''),
          email: `${dadosCliente.nome.toLowerCase().replace(/\s/g, '')}@email.com`,
          endereco: dadosCliente.rua,
          numero: dadosCliente.numero,
          bairro: dadosCliente.bairro,
          cidade: dadosCliente.cidade,
          estado: dadosCliente.estado,
          cep: dadosCliente.cep.replace(/\D/g, ''),
          complemento: dadosCliente.complemento,
          ponto_referencia: dadosCliente.ponto_referencia
        })
        console.log('✅ Cliente registrado')
      } catch (error) {
        console.log('ℹ️ Cliente já existe ou erro ao criar:', error)
      }

      // 3️⃣ GERAR PIX NO PAGBANK
      console.log('3️⃣ Gerando PIX no PagBank...')
      const pixResponse = await fetch('/api/pagbank/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: total,
          dadosCliente: {
            nome: dadosCliente.nome,
            email: `${dadosCliente.nome.toLowerCase().replace(/\s/g, '')}@email.com`,
            cpf: dadosCliente.cpf,
            telefone: dadosCliente.telefone || '(22)99999-9999',
            endereco: dadosCliente.rua || 'Rua Principal',
            numero: dadosCliente.numero || 'S/N',
            complemento: dadosCliente.complemento || '',
            bairro: dadosCliente.bairro || 'Centro',
            cidade: dadosCliente.cidade || 'Rio das Ostras',
            estado: dadosCliente.estado || 'RJ',
            cep: dadosCliente.cep || '00000000'
          },
          carrinho: carrinho.map(item => ({
            nome: item.nome,
            quantidade: item.qtd,
            preco: item.preco
          })),
          vendaId: venda.id
        })
      })

      const pixData = await pixResponse.json()

      if (!pixData.success) {
        throw new Error(pixData.error || 'Erro ao gerar PIX')
      }

      console.log('✅ PIX gerado com sucesso!')
      console.log('📦 Order ID:', pixData.id)
      console.log('🔗 Reference ID:', pixData.reference_id)

      setPixGerado({
        id: pixData.id,
        reference_id: pixData.reference_id,
        qr_code: pixData.qr_code,
        qr_code_base64: pixData.qr_code_base64,
        expiration_date: pixData.expiration_date,
        status: pixData.status
      })

      setEtapa(3)
      console.log('═══════════════════════════════════════')

    } catch (error: any) {
      console.error('❌ Erro ao finalizar pedido:', error)
      alert(`Erro: ${error.message || 'Erro ao processar pagamento'}`)
      
      // Reverter venda se houver erro
      if (vendaId) {
        try {
          await atualizarStatusVenda(vendaId, 'cancelado')
        } catch (err) {
          console.error('Erro ao cancelar venda:', err)
        }
      }
    } finally {
      setCarregandoPix(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-[#0d4a76] text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* LOGO */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white rounded-lg p-1.5 sm:p-2">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-[#0d4a76]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="font-bold text-base sm:text-lg md:text-xl leading-tight">
                  Fácil Material
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-200 leading-tight">
                  Construção e Bazar
                </p>
              </div>
            </div>

            {/* CARRINHO */}
            {etapa === 1 && (
              <button
                onClick={() => setEtapa(2)}
                disabled={carrinho.length === 0}
                className={`${
                  carrinho.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 transition-all shadow-lg disabled:shadow-none text-xs sm:text-sm font-semibold`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
                <span className="hidden xs:inline">Carrinho</span>
                {carrinho.length > 0 && (
                  <span className="bg-white text-[#0d4a76] rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-bold">
                    {carrinho.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

    {/* CONTEÚDO */}
    {etapa === 1 && (
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        
        {/* FILTROS */}
        <div className="mb-4 sm:mb-6">
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 no-scrollbar">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`${
                  categoriaFiltro === cat
                    ? 'bg-[#0d4a76] text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                } px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold whitespace-nowrap transition-all text-xs sm:text-sm`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* GRID DE PRODUTOS */}
        {carregandoProdutos ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#0d4a76]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {produtosFiltrados.map(produto => (
              <div
                key={produto.id}
                className="bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden flex flex-col"
              >
                {/* IMAGEM */}
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={produto.imagem}
                    alt={produto.nome}
                    className="w-full h-full object-cover"
                  />
                  {produto.estoque === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white font-bold text-xs sm:text-sm px-2 py-1 bg-red-600 rounded-full">
                        Esgotado
                      </span>
                    </div>
                  )}
                </div>

                {/* INFO */}
                <div className="p-2.5 sm:p-3 flex-1 flex flex-col">
                  <h3 className="font-bold text-xs sm:text-sm text-gray-800 mb-1 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
                    {produto.nome}
                  </h3>
                  
                  <div className="mt-auto">
                    <p className="text-base sm:text-lg font-bold text-[#0d4a76] mb-2 sm:mb-3">
                      R$ {produto.preco.toFixed(2)}
                    </p>

                    <button
                      onClick={() => adicionarAoCarrinho(produto)}
                      disabled={produto.estoque === 0}
                      className={`${
                        produto.estoque === 0
                          ? 'bg-gray-300 cursor-not-allowed'
                          : botaoClicado === produto.id
                          ? 'bg-green-600 scale-95'
                          : 'bg-orange-500 hover:bg-orange-600'
                      } w-full text-white py-1.5 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5`}
                    >
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                      </svg>
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    )}

    {/* ETAPA 2: DADOS DO CLIENTE */}
    {etapa === 2 && (
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
          
          {/* CABEÇALHO */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Dados do Cliente</h2>
            <button
              onClick={() => setEtapa(1)}
              className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-semibold"
            >
              ← Voltar
            </button>
          </div>

          {/* FORMULÁRIO */}
          <div className="space-y-3 sm:space-y-4">
            {/* CPF */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                CPF *
              </label>
              <input
                type="text"
                value={dadosCliente.cpf}
                onChange={(e) => setDadosCliente({ ...dadosCliente, cpf: formatarCPF(e.target.value) })}
                onBlur={buscarCliente}
                placeholder="000.000.000-00"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>

            {/* NOME */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={dadosCliente.nome}
                onChange={(e) => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
                placeholder="Digite seu nome"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>

            {/* TELEFONE */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                Telefone
              </label>
              <input
                type="text"
                value={dadosCliente.telefone}
                onChange={(e) => setDadosCliente({ ...dadosCliente, telefone: formatarTelefone(e.target.value) })}
                placeholder="(00)00000-0000"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>

            {/* RUA E NÚMERO */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Rua/Avenida
                </label>
                <input
                  type="text"
                  value={dadosCliente.rua}
                  onChange={(e) => setDadosCliente({ ...dadosCliente, rua: e.target.value })}
                  placeholder="Nome da rua"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
                />
              </div>
              <div className="sm:w-24">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Número
                </label>
                <input
                  type="text"
                  value={dadosCliente.numero}
                  onChange={(e) => setDadosCliente({ ...dadosCliente, numero: e.target.value })}
                  placeholder="Nº"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
                />
              </div>
            </div>

            {/* BAIRRO */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                Bairro
              </label>
              <input
                type="text"
                value={dadosCliente.bairro}
                onChange={(e) => setDadosCliente({ ...dadosCliente, bairro: e.target.value })}
                placeholder="Nome do bairro"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>

            {/* CIDADE E ESTADO */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  value={dadosCliente.cidade}
                  onChange={(e) => setDadosCliente({ ...dadosCliente, cidade: e.target.value })}
                  placeholder="Cidade"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Estado
                </label>
                <input
                  type="text"
                  value={dadosCliente.estado}
                  onChange={(e) => setDadosCliente({ ...dadosCliente, estado: e.target.value.toUpperCase() })}
                  placeholder="UF"
                  maxLength={2}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
                />
              </div>
            </div>

            {/* CEP */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                CEP
              </label>
              <input
                type="text"
                value={dadosCliente.cep}
                onChange={(e) => {
                  const numeros = e.target.value.replace(/\D/g, '').slice(0, 8)
                  const cepFormatado = numeros.replace(/(\d{5})(\d)/, '$1-$2')
                  setDadosCliente({ ...dadosCliente, cep: cepFormatado })
                }}
                placeholder="00000-000"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>

            {/* COMPLEMENTO */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                Complemento
              </label>
              <input
                type="text"
                value={dadosCliente.complemento}
                onChange={(e) => setDadosCliente({ ...dadosCliente, complemento: e.target.value })}
                placeholder="Apto, bloco, etc."
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>

            {/* PONTO DE REFERÊNCIA */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                Ponto de Referência
              </label>
              <input
                type="text"
                value={dadosCliente.ponto_referencia}
                onChange={(e) => setDadosCliente({ ...dadosCliente, ponto_referencia: e.target.value })}
                placeholder="Ex: Perto do mercado"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#0d4a76] focus:outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          {/* CARRINHO RESUMO */}
          <div className="mt-6 sm:mt-8 bg-gray-50 rounded-lg p-3 sm:p-4">
            <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3">Itens do Pedido</h3>
            <div className="space-y-1.5 sm:space-y-2 max-h-40 sm:max-h-60 overflow-y-auto">
              {carrinho.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-xs sm:text-sm">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                      <button
                        onClick={() => alterarQuantidade(item.id, item.qtd - 1)}
                        className="text-red-600 hover:text-red-700 font-bold text-base sm:text-lg"
                      >
                        −
                      </button>
                      <span className="font-bold min-w-[1.5rem] text-center">{item.qtd}</span>
                      <button
                        onClick={() => alterarQuantidade(item.id, item.qtd + 1)}
                        className="text-green-600 hover:text-green-700 font-bold text-base sm:text-lg"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-medium">{item.nome}</span>
                  </div>
                  <span className="font-bold">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 sm:mt-4 pt-2 sm:pt-3 flex justify-between text-base sm:text-lg font-bold">
              <span>Total:</span>
              <span className="text-orange-500">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* BOTÃO FINALIZAR */}
          <button
            onClick={finalizarPedido}
            disabled={!dadosCliente.nome || !dadosCliente.cpf || carrinho.length === 0}
            className="w-full mt-4 sm:mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 sm:py-4 rounded-xl text-base sm:text-lg font-bold transition-all shadow-lg disabled:cursor-not-allowed"
          >
            Gerar PIX e Finalizar
          </button>
        </div>
      </main>
    )}

    {/* ETAPA 3: PAGAMENTO PIX */}
    {etapa === 3 && (
        <main className="flex-1 w-full">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">

              {/* DADOS DO CLIENTE */}
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                <h3 className="font-bold text-sm sm:text-base mb-2">Dados do Cliente</h3>
                <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-gray-700">
                  <p><span className="font-semibold">Nome:</span> {dadosCliente.nome}</p>
                  <p><span className="font-semibold">CPF:</span> {dadosCliente.cpf}</p>
                  {dadosCliente.telefone && (
                    <p><span className="font-semibold">Telefone:</span> {dadosCliente.telefone}</p>
                  )}
                  {dadosCliente.rua && (
                    <p><span className="font-semibold">Endereço:</span> {dadosCliente.rua}, {dadosCliente.numero} - {dadosCliente.bairro}</p>
                  )}
                  <p><span className="font-semibold">Cidade:</span> {dadosCliente.cidade}/{dadosCliente.estado}</p>
                </div>
              </div>

              {/* PRODUTOS */}
              <div>
                <h3 className="font-bold text-sm sm:text-sm mb-2">Produtos</h3>
                {carrinho.map((item, index) => (
                  <div className="flex justify-between items-start gap-3 py-1.5 sm:py-2 text-sm text-gray-700" key={index}>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{item.qtd}x</span> {item.nome}
                    </div>
                    <div className="flex-shrink-0 font-semibold whitespace-nowrap ml-2">
                      R$ {(item.preco * item.qtd).toFixed(2)}
                    </div>
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
                  <h3 className="font-bold text-green-700 text-base sm:text-lg">Pagamento via PIX - PagBank</h3>

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

                  {/* STATUS DO PAGAMENTO */}
                  {statusPagamento === 'pendente' ? (
                    /* AGUARDANDO - AMARELO */
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 rounded-lg p-3 sm:p-4 font-semibold text-xs sm:text-sm text-yellow-800 flex items-center gap-2 sm:gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-yellow-600" />
                      <span>Aguardando confirmação do pagamento...</span>
                    </div>
                  ) : (
                    /* CONFIRMADO - AZUL */
                    <div className="bg-blue-100 border-l-4 border-blue-500 rounded-lg p-3 sm:p-4 font-semibold text-xs sm:text-sm text-blue-800 flex items-center gap-2 sm:gap-3">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      <span>Pagamento confirmado!</span>
                    </div>
                  )}
                  
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

                  {/* IDs */}
                  <div className="text-[10px] sm:text-xs text-center text-gray-500 space-y-0.5">
                    <p>ID do Pedido PagBank: <span className="font-mono font-bold">{pixGerado.id}</span></p>
                    {pixGerado.reference_id && (
                      <p>Referência: <span className="font-mono font-bold">{pixGerado.reference_id}</span></p>
                    )}
                    {vendaId && (
                      <p>ID da Venda: <span className="font-mono font-bold">#{vendaId}</span></p>
                    )}
                  </div>

                  {/* CANCELAR */}
                  <button
                    onClick={() => {
                      setCarrinho([])
                      setEtapa(1)
                      setPixGerado(null)
                      setStatusPagamento('pendente')
                      setVendaId(null)
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