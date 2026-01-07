'use client'

import { useState, useEffect } from 'react'
import { 
  buscarProdutos, 
  adicionarProduto, 
  atualizarProduto,
  deletarProduto,
  buscarClientes,
  buscarVendas,
  gerarProximoCodigo,
  Produto,
  Cliente,
  Venda
} from '@/lib/supabase'

export default function AdminPage() {
  const [menuAtivo, setMenuAtivo] = useState('produtos')
  
  // Estados para produtos
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(true)
  const [novoProduto, setNovoProduto] = useState({
    nome: '',
    preco: '',
    estoque: '',
    categoria: '',
    unidade: 'un',
    imagem: ''
  })
  const [imagemPreview, setImagemPreview] = useState('')
  const [imagemEditadaPreview, setImagemEditadaPreview] = useState('')
  const [editandoProduto, setEditandoProduto] = useState<number | null>(null)
  const [produtoEditado, setProdutoEditado] = useState<Produto | null>(null)

  // Estados para vendas e clientes
  const [vendas, setVendas] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregandoVendas, setCarregandoVendas] = useState(false)
  const [carregandoClientes, setCarregandoClientes] = useState(false)
  const [gatewayAtivo, setGatewayAtivo] = useState<'mercadopago' | 'pagbank'>('mercadopago')
  const [lojaAtiva, setLojaAtiva] = useState(true)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [mensagemConfig, setMensagemConfig] = useState('')

  // Carregar produtos ao montar
  useEffect(() => {
    carregarProdutos()
  }, [])

  // Carregar vendas quando mudar para aba vendas
  useEffect(() => {
    if (menuAtivo === 'vendas' && vendas.length === 0) {
      carregarVendas()
    }
  }, [menuAtivo])

  // Carregar clientes quando mudar para aba clientes
  useEffect(() => {
    if (menuAtivo === 'clientes' && clientes.length === 0) {
      carregarClientes()
    }
  }, [menuAtivo])

  useEffect(() => {
    carregarConfiguracoes()
  }, [])

  const carregarProdutos = async () => {
    try {
      setCarregandoProdutos(true)
      const data = await buscarProdutos()
      setProdutos(data)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      alert('Erro ao carregar produtos do banco de dados')
    } finally {
      setCarregandoProdutos(false)
    }
  }

  const carregarVendas = async () => {
    try {
      setCarregandoVendas(true)
      const data = await buscarVendas()
      setVendas(data)
    } catch (error) {
      console.error('Erro ao carregar vendas:', error)
      alert('Erro ao carregar vendas do banco de dados')
    } finally {
      setCarregandoVendas(false)
    }
  }

  const carregarClientes = async () => {
    try {
      setCarregandoClientes(true)
      const data = await buscarClientes()
      setClientes(data)
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      alert('Erro ao carregar clientes do banco de dados')
    } finally {
      setCarregandoClientes(false)
    }
  }


  // 💳 FUNÇÕES DE CONFIGURAÇÃO
  const carregarConfiguracoes = async () => {
    try {
      const response = await fetch('/api/configuracoes')
      const data = await response.json()

      if (data.success && data.configuracoes) {
        setGatewayAtivo(data.configuracoes.gateway_pagamento || 'mercadopago')
        setLojaAtiva(data.configuracoes.loja_ativa !== false)
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  const salvarConfiguracoes = async () => {
    setSalvandoConfig(true)
    try {
      const response = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway_pagamento: gatewayAtivo,
          loja_ativa: lojaAtiva
        })
      })

      const data = await response.json()

      if (data.success) {
        setMensagemConfig('✅ Configurações salvas com sucesso!')
        setTimeout(() => setMensagemConfig(''), 3000)
      } else {
        setMensagemConfig('❌ Erro ao salvar configurações')
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setMensagemConfig('❌ Erro ao salvar configurações')
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Função para lidar com upload de imagem
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setImagemPreview(result)
        setNovoProduto({ ...novoProduto, imagem: result })
      }
      reader.readAsDataURL(file)
    }
  }

  // Função para upload de imagem na edição
  const handleImageUploadEdicao = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setImagemEditadaPreview(result)
        if (produtoEditado) {
          setProdutoEditado({ ...produtoEditado, imagem: result })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Função para adicionar produto NO BANCO
  const adicionarProdutoNoBanco = async () => {
    if (!novoProduto.nome || !novoProduto.preco || !novoProduto.estoque) {
      alert('Preencha todos os campos!')
      return
    }

    try {
      // Gerar código automático
      const codigo = await gerarProximoCodigo()

      const produto = {
        codigo,
        nome: novoProduto.nome,
        preco: parseFloat(novoProduto.preco),
        estoque: parseInt(novoProduto.estoque),
        categoria: novoProduto.categoria || 'Geral',
        unidade: novoProduto.unidade,
        imagem: novoProduto.imagem || 'https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=Produto'
      }

      await adicionarProduto(produto)
      
      // Limpar formulário
      setNovoProduto({ nome: '', preco: '', estoque: '', categoria: '', unidade: 'un', imagem: '' })
      setImagemPreview('')
      
      // Recarregar produtos
      await carregarProdutos()
      
      alert(`✓ Produto adicionado com sucesso!\nCódigo: ${codigo}`)
    } catch (error) {
      console.error('Erro ao adicionar produto:', error)
      alert('Erro ao adicionar produto ao banco de dados')
    }
  }

  // Função para iniciar edição
  const iniciarEdicao = (produto: Produto) => {
    setEditandoProduto(produto.id)
    setProdutoEditado({ ...produto })
    setImagemEditadaPreview(produto.imagem) // Carregar imagem atual
  }

  // Função para salvar edição NO BANCO
  const salvarEdicaoNoBanco = async () => {
    if (!produtoEditado) return

    try {
      await atualizarProduto(produtoEditado.id, {
        nome: produtoEditado.nome,
        categoria: produtoEditado.categoria,
        preco: produtoEditado.preco,
        estoque: produtoEditado.estoque,
        unidade: produtoEditado.unidade,
        imagem: produtoEditado.imagem // Incluir imagem
      })
      
      setEditandoProduto(null)
      setProdutoEditado(null)
      
      // Recarregar produtos
      await carregarProdutos()
      
      alert('✓ Produto atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao atualizar produto:', error)
      alert('Erro ao atualizar produto no banco de dados')
    }
  }

  // Função para cancelar edição
  const cancelarEdicao = () => {
    setEditandoProduto(null)
    setProdutoEditado(null)
    setImagemEditadaPreview('') // Limpar preview
  }

  // Função para deletar produto
  const deletarProdutoConfirmar = async (produto: Produto) => {
    const confirmacao = confirm(`Tem certeza que deseja deletar o produto?\n\n${produto.codigo} - ${produto.nome}`)
    
    if (!confirmacao) return

    try {
      await deletarProduto(produto.id)
      
      // Recarregar produtos
      await carregarProdutos()
      
      alert('✓ Produto deletado com sucesso!')
    } catch (error) {
      console.error('Erro ao deletar produto:', error)
      alert('Erro ao deletar produto do banco de dados')
    }
  }

  // No final da função AdminPage, substitua o return por este:
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-lg">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold">FÁCIL MATERIAIS</div>
              <div className="text-xs text-gray-400">Admin Panel v2.0</div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4">
          <button
            onClick={() => setMenuAtivo('produtos')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
              menuAtivo === 'produtos' 
                ? 'bg-orange-500 text-white' 
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
            <span className="font-semibold">ESTOQUE</span>
          </button>

          <button
            onClick={() => setMenuAtivo('vendas')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
              menuAtivo === 'vendas' 
                ? 'bg-orange-500 text-white' 
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <span className="font-semibold">VENDAS</span>
          </button>

          <button
            onClick={() => setMenuAtivo('clientes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
              menuAtivo === 'clientes' 
                ? 'bg-orange-500 text-white' 
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            <span className="font-semibold">CLIENTES</span>
          </button>

          <button
            onClick={() => setMenuAtivo('configuracoes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              menuAtivo === 'configuracoes' 
                ? 'bg-orange-500 text-white' 
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            <span className="font-semibold">CONFIGURAÇÕES</span>
          </button>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 overflow-auto p-8">
        
        {/* ABA PRODUTOS */}
        {menuAtivo === 'produtos' && (
          <div>
            <h1>Produtos</h1>
            {/* ... seu código de produtos aqui ... */}
          </div>
        )}

        {/* ABA VENDAS */}
        {menuAtivo === 'vendas' && (
          <div>
            <h1>Vendas</h1>
            {/* ... seu código de vendas aqui ... */}
          </div>
        )}

        {/* ABA CLIENTES */}
        {menuAtivo === 'clientes' && (
          <div>
            <h1>Clientes</h1>
            {/* ... seu código de clientes aqui ... */}
          </div>
        )}

        {/* ABA CONFIGURAÇÕES - VERSÃO MELHORADA */}
        {menuAtivo === 'configuracoes' && (
          <div className="space-y-6">
            {/* Título Principal */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Configurações da Loja</h2>
              <p className="text-gray-600">Gerencie as configurações do seu sistema de pagamentos</p>
            </div>

            {/* Mensagem de feedback */}
            {mensagemConfig && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                mensagemConfig.includes('✅') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {mensagemConfig.includes('✅') ? (
                  <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>
                )}
                <span className="font-medium">{mensagemConfig}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card Gateway de Pagamento */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Gateway de Pagamento</h3>
                      <p className="text-sm text-blue-100">Configure como processar pagamentos</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Mercado Pago */}
                  <label className={`group flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    gatewayAtivo === 'mercadopago' 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}>
                    <div className="relative">
                      <input
                        type="radio"
                        name="gateway"
                        value="mercadopago"
                        checked={gatewayAtivo === 'mercadopago'}
                        onChange={() => setGatewayAtivo('mercadopago')}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        gatewayAtivo === 'mercadopago' 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {gatewayAtivo === 'mercadopago' && (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">Mercado Pago</span>
                        {gatewayAtivo === 'mercadopago' && (
                          <span className="bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">ATIVO</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        ✅ Funciona imediatamente sem aprovação prévia
                      </p>
                    </div>
                  </label>

                  {/* PagBank */}
                  <label className={`group flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    gatewayAtivo === 'pagbank' 
                      ? 'border-green-500 bg-green-50 shadow-md' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}>
                    <div className="relative">
                      <input
                        type="radio"
                        name="gateway"
                        value="pagbank"
                        checked={gatewayAtivo === 'pagbank'}
                        onChange={() => setGatewayAtivo('pagbank')}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        gatewayAtivo === 'pagbank' 
                          ? 'border-green-500 bg-green-500' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {gatewayAtivo === 'pagbank' && (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">PagBank</span>
                        {gatewayAtivo === 'pagbank' && (
                          <span className="bg-green-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">ATIVO</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        ⏳ Requer aprovação prévia (1-2 dias úteis)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Card Status da Loja */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4 0-7-3-7-7V8.3l7-3.11L19 8.3V13c0 4-3 7-7 7zm-1-5h2v2h-2zm0-8h2v6h-2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Status da Loja</h3>
                      <p className="text-sm text-purple-100">Controle de disponibilidade</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-xl text-gray-900">Loja Online</span>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            lojaAtiva 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {lojaAtiva ? '🟢 ONLINE' : '🔴 OFFLINE'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {lojaAtiva 
                            ? '✅ Clientes podem fazer pedidos normalmente' 
                            : '⚠️ Loja em manutenção - pedidos bloqueados'}
                        </p>
                      </div>
                      
                      <div className="ml-6 relative inline-block">
                        <input
                          type="checkbox"
                          checked={lojaAtiva}
                          onChange={(e) => setLojaAtiva(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-16 h-8 rounded-full transition-all duration-300 ${
                          lojaAtiva ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                          lojaAtiva ? 'translate-x-8' : ''
                        }`}></div>
                      </div>
                    </label>
                  </div>

                  {/* Estatísticas */}
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">15</div>
                      <div className="text-xs text-blue-700 font-medium">Pedidos Hoje</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">R$ 1.245</div>
                      <div className="text-xs text-green-700 font-medium">Faturamento</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão Salvar */}
            <div className="flex justify-center pt-4">
              <button
                onClick={salvarConfiguracoes}
                disabled={salvandoConfig}
                className="group relative bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-4 rounded-xl font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {salvandoConfig ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Salvando Configurações...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                    </svg>
                    <span>Salvar Configurações</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}