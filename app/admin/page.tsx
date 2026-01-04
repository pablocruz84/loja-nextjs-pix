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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#2C3E50] text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className="font-bold text-lg">FÁCIL MATERIAIS</span>
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
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

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-700 text-center text-sm text-gray-400">
          Admin Panel v2.0
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 overflow-auto justify-center">
        {/* CADASTRO DE PRODUTOS */}
        {menuAtivo === 'produtos' && (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">CADASTRO DE PRODUTOS</h1>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              {/* URL da Imagem */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL da Imagem
                </label>
                <input
                  type="text"
                  value={novoProduto.imagem}
                  onChange={(e) => {
                    setNovoProduto({ ...novoProduto, imagem: e.target.value })
                    setImagemPreview(e.target.value)
                  }}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                {imagemPreview && (
                  <div className="mt-4 border-2 border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Preview:</p>
                    <img 
                      src={imagemPreview} 
                      alt="Preview" 
                      className="max-h-48 mx-auto rounded-lg"
                      onError={() => setImagemPreview('')}
                    />
                  </div>
                )}
              </div>

              {/* Formulário */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Produto</label>
                  <input
                    type="text"
                    value={novoProduto.nome}
                    onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })}
                    placeholder="Ex: Cimento CP II"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
                  <input
                    type="text"
                    value={novoProduto.categoria}
                    onChange={(e) => setNovoProduto({ ...novoProduto, categoria: e.target.value })}
                    placeholder="Ex: Cimento"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Preço</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoProduto.preco}
                    onChange={(e) => setNovoProduto({ ...novoProduto, preco: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quantidade em Estoque</label>
                  <input
                    type="number"
                    value={novoProduto.estoque}
                    onChange={(e) => setNovoProduto({ ...novoProduto, estoque: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unidade de Medida</label>
                  <select
                    value={novoProduto.unidade}
                    onChange={(e) => setNovoProduto({ ...novoProduto, unidade: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="m">Metro (m)</option>
                    <option value="m²">Metro Quadrado (m²)</option>
                    <option value="m³">Metro Cúbico (m³)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="pç">Peça (pç)</option>
                    <option value="sc">Saco (sc)</option>
                  </select>
                </div>
                </div>
              </div>

              <button
                onClick={adicionarProdutoNoBanco}
                className="mt-6 bg-orange-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-orange-600 transition flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                ADINICAR PRODUTO
              </button>

              {/* Lista de Produtos - Tabela */}
              {carregandoProdutos ? (
                <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center">
                  <p className="text-gray-500">Carregando produtos...</p>
                </div>
              ) : produtos.length > 0 ? (
                <div className="mt-8 pt-6 border-t-2 border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                    </svg>
                    Produtos Cadastrados ({produtos.length})
                  </h2>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-50">
                          <th className="text-left p-3 font-bold text-gray-700">Imagem</th>
                          <th className="text-left p-3 font-bold text-gray-700">Código</th>
                          <th className="text-left p-3 font-bold text-gray-700">Nome</th>
                          <th className="text-left p-3 font-bold text-gray-700">Categoria</th>
                          <th className="text-left p-3 font-bold text-gray-700">Preço</th>
                          <th className="text-left p-3 font-bold text-gray-700">Estoque</th>
                          <th className="text-left p-3 font-bold text-gray-700">Unidade</th>
                          <th className="text-center p-3 font-bold text-gray-700">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtos.map(produto => (
                          <tr key={produto.id} className="border-b border-gray-200 hover:bg-gray-50">
                            {/* Imagem */}
                            <td className="p-3">
                              <img 
                                src={produto.imagem} 
                                alt={produto.nome}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            </td>

                            {/* Código */}
                            <td className="p-3">
                              <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs font-bold">
                                {produto.codigo}
                              </span>
                            </td>

                            {/* Nome */}
                            <td className="p-3">
                              <span className="font-semibold text-gray-800">{produto.nome}</span>
                            </td>

                            {/* Categoria */}
                            <td className="p-3">
                              <span className="text-gray-600">{produto.categoria}</span>
                            </td>

                            {/* Preço */}
                            <td className="p-3">
                              <span className="font-bold text-orange-500">R$ {produto.preco.toFixed(2)}</span>
                            </td>

                            {/* Estoque */}
                            <td className="p-3">
                              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
                                {produto.estoque}
                              </span>
                            </td>

                            {/* Unidade */}
                            <td className="p-3">
                              <span className="text-gray-600 font-medium">{produto.unidade}</span>
                            </td>

                            {/* Ações */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => iniciarEdicao(produto)}
                                  className="bg-blue-500 text-white px-3 py-1 rounded-lg font-bold text-sm hover:bg-blue-600 transition flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                  </svg>
                                  Editar
                                </button>
                                <button
                                  onClick={() => deletarProdutoConfirmar(produto)}
                                  className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold text-sm hover:bg-red-600 transition flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                  </svg>
                                  Deletar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center">
                  <p className="text-gray-500">Nenhum produto cadastrado ainda.</p>
                </div>
              )}
            </div>
        )}

        {/* LISTA DE VENDAS */}
        {menuAtivo === 'vendas' && (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">CADASTRO DE VENDAS</h1>

            <div className="bg-white rounded-lg shadow-md p-6">
              {carregandoVendas ? (
                <p className="text-center text-gray-500">Carregando vendas...</p>
              ) : vendas.length > 0 ? (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-orange-100 p-4 rounded-lg flex-1">
                      <p className="text-sm text-gray-600">Total de Vendas</p>
                      <p className="text-3xl font-bold text-orange-500">{vendas.length}</p>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg flex-1">
                      <p className="text-sm text-gray-600">Faturamento</p>
                      <p className="text-3xl font-bold text-green-500">
                        R$ {vendas.reduce((acc, v) => acc + parseFloat(v.total || 0), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold text-gray-700">ID</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Cliente</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Total</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Data</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendas.map(venda => (
                        <tr key={venda.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">#{venda.id}</td>
                          <td className="p-3">{venda.clientes?.nome || 'N/A'}</td>
                          <td className="p-3 font-bold text-orange-500">R$ {parseFloat(venda.total).toFixed(2)}</td>
                          <td className="p-3 text-sm">{new Date(venda.data_venda).toLocaleDateString('pt-BR')}</td>
                          <td className="p-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              venda.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {venda.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="text-center text-gray-500">Nenhuma venda registrada ainda.</p>
              )}
            </div>
          </div>
        )}

        {/* LISTA DE CLIENTES */}
        {menuAtivo === 'clientes' && (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">CADASTRO DE CLIENTE AUTOMÁTICO</h1>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              {carregandoClientes ? (
                <p className="text-center text-gray-500">Carregando clientes...</p>
              ) : clientes.length > 0 ? (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-100 p-4 rounded-lg flex-1">
                      <p className="text-sm text-gray-600">Total de Clientes</p>
                      <p className="text-3xl font-bold text-blue-500">{clientes.length}</p>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-6">
                    ℹ️ Os clientes são cadastrados automaticamente quando fazem a primeira compra.
                  </p>

                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold text-gray-700">Nome</th>
                        <th className="text-left p-3 font-semibold text-gray-700">CPF</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Telefone</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Cidade</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Compras</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map(cliente => (
                        <tr key={cliente.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-semibold">{cliente.nome}</td>
                          <td className="p-3 text-sm">{cliente.cpf}</td>
                          <td className="p-3 text-sm">{cliente.telefone}</td>
                          <td className="p-3 text-sm text-gray-600">{cliente.cidade}</td>
                          <td className="p-3">
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">
                              {cliente.total_compras}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="text-center text-gray-500">Nenhum cliente cadastrado ainda.</p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE EDIÇÃO */}
      {editandoProduto && produtoEditado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Editar Produto</h2>
              
              {/* URL da Imagem */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL da Imagem
                </label>
                <input
                  type="text"
                  value={produtoEditado.imagem}
                  onChange={(e) => {
                    setProdutoEditado({ ...produtoEditado, imagem: e.target.value })
                    setImagemEditadaPreview(e.target.value)
                  }}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                {imagemEditadaPreview && (
                  <div className="mt-4 border-2 border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Preview:</p>
                    <img 
                      src={imagemEditadaPreview} 
                      alt="Preview" 
                      className="max-h-48 mx-auto rounded-lg"
                      onError={() => setImagemEditadaPreview('')}
                    />
                  </div>
                )}
              </div>

              {/* Campos de Edição */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome</label>
                  <input
                    type="text"
                    value={produtoEditado.nome}
                    onChange={(e) => setProdutoEditado({ ...produtoEditado, nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
                  <input
                    type="text"
                    value={produtoEditado.categoria}
                    onChange={(e) => setProdutoEditado({ ...produtoEditado, categoria: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Preço</label>
                  <input
                    type="number"
                    step="0.01"
                    value={produtoEditado.preco}
                    onChange={(e) => setProdutoEditado({ ...produtoEditado, preco: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estoque</label>
                  <input
                    type="number"
                    value={produtoEditado.estoque}
                    onChange={(e) => setProdutoEditado({ ...produtoEditado, estoque: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unidade de Medida</label>
                  <select
                    value={produtoEditado.unidade}
                    onChange={(e) => setProdutoEditado({ ...produtoEditado, unidade: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="m">Metro (m)</option>
                    <option value="m²">Metro Quadrado (m²)</option>
                    <option value="m³">Metro Cúbico (m³)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="pç">Peça (pç)</option>
                    <option value="sc">Saco (sc)</option>
                  </select>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={salvarEdicaoNoBanco}
                  className="flex-1 bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition"
                >
                  ✓ Salvar Alterações
                </button>
                <button
                  onClick={cancelarEdicao}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-bold hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💳 ABA CONFIGURAÇÕES */}
      {menuAtivo === 'configuracoes' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center">⚙️ Configurações da Loja</h2>

          {/* Mensagem de feedback */}
          {mensagemConfig && (
            <div className={`p-4 rounded-lg ${
              mensagemConfig.includes('✅') 
                ? 'bg-green-100 text-green-800 border-l-4 border-green-500' 
                : 'bg-red-100 text-red-800 border-l-4 border-red-500'
            }`}>
              {mensagemConfig}
            </div>
          )}

          {/* Gateway de Pagamento */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4 text-center">💳 Gateway de Pagamento</h3>
            <p className="text-gray-600 mb-6 text-center">
              Escolha qual gateway será usado para processar os pagamentos PIX.
            </p>

            <div className="space-y-4 max-w-2xl mx-auto">
              {/* Mercado Pago */}
              <label className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                gatewayAtivo === 'mercadopago' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="gateway"
                  value="mercadopago"
                  checked={gatewayAtivo === 'mercadopago'}
                  onChange={() => setGatewayAtivo('mercadopago')}
                  className="mt-1 w-5 h-5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">Mercado Pago</span>
                    {gatewayAtivo === 'mercadopago' && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">ATIVO</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Funciona imediatamente sem aprovação prévia.
                  </p>
                </div>
              </label>

              {/* PagBank */}
              <label className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                gatewayAtivo === 'pagbank' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="gateway"
                  value="pagbank"
                  checked={gatewayAtivo === 'pagbank'}
                  onChange={() => setGatewayAtivo('pagbank')}
                  className="mt-1 w-5 h-5 text-green-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">PagBank</span>
                    {gatewayAtivo === 'pagbank' && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">ATIVO</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Requer aprovação prévia (1-2 dias).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Status da Loja */}
          <div className="bg-white p-6 rounded-lg shadow max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-4 text-center">🏪 Status da Loja</h3>
            
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-semibold mb-1">Loja Online</p>
                <p className="text-sm text-gray-600">
                  {lojaAtiva ? 'Clientes podem fazer pedidos' : 'Loja em manutenção'}
                </p>
              </div>
              <div className="relative inline-block w-14 h-7">
                <input
                  type="checkbox"
                  checked={lojaAtiva}
                  onChange={(e) => setLojaAtiva(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-14 h-7 rounded-full transition ${
                  lojaAtiva ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <div className={`absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  lojaAtiva ? 'translate-x-7' : ''
                }`}></div>
              </div>
            </label>
          </div>

          <div className="max-w-2xl mx-auto">
          {/* Botão Salvar */}
          <button
            onClick={salvarConfiguracoes}
            disabled={salvandoConfig}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {salvandoConfig ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                </svg>
                Salvar Configurações
              </>
            )}
          </button>
          </div>
        </div>
      )}
    </div>
  )
}