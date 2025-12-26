// lib/gerarPedidoPDF.ts - VERSÃO PROFISSIONAL COM CABEÇALHO COMPLETO

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ItemCarrinho {
  id: number
  nome: string
  preco: number
  qtd: number
  unidade?: string
}

interface DadosCliente {
  nome: string
  cpf: string
  telefone: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  pontoReferencia?: string
}

interface DadosPedido {
  pedidoId: string
  data: string
  cliente: DadosCliente
  itens: ItemCarrinho[]
  subtotal: number
  taxaEntrega: number
  total: number
  logoBase64?: string
}

export function gerarPedidoPDF(dados: DadosPedido): jsPDF {
  const doc = new jsPDF()
  
  // ============================================
  // CABEÇALHO COMPLETO COM FUNDO AZUL
  // ============================================
  
  // Fundo azul do cabeçalho (mais alto para caber todas as informações)
  doc.setFillColor(13, 74, 118) // #0d4a76 - cor azul da Fácil
  doc.rect(0, 0, 210, 42, 'F')
  
  // Borda dourada no cabeçalho
  doc.setDrawColor(255, 215, 0) // Dourado
  doc.setLineWidth(2)
  doc.rect(5, 5, 200, 32, 'S')
  
  // LOGO E NOME DA EMPRESA (Lado Esquerdo)
  if (dados.logoBase64) {
    try {
      doc.addImage(dados.logoBase64, 'PNG', 10, 10, 60, 15)
    } catch (error) {
      // Texto da logo se falhar
      doc.setTextColor(255, 215, 0)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('FÁCIL', 15, 18)
      doc.setFontSize(8)
      doc.text('MATERIAL DE CONSTRUÇÃO E BAZAR', 15, 24)
    }
  } else {
    // Texto da logo (padrão)
    doc.setTextColor(255, 215, 0) // Dourado
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('FÁCIL', 15, 18)
    doc.setFontSize(8)
    doc.text('MATERIAL DE CONSTRUÇÃO E BAZAR', 15, 24)
  }
  
  // INFORMAÇÕES DA EMPRESA (Lado Direito)
  doc.setTextColor(255, 255, 255) // Branco
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  
  let yInfo = 12
  doc.text('Estrada Professor Leandro Farias Sarzedas', 205, yInfo, { align: 'right' })
  yInfo += 4
  doc.text('Cantagalo - Rio das Ostras / RJ', 205, yInfo, { align: 'right' })
  yInfo += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Telefone: (22) 99913-1594', 205, yInfo, { align: 'right' })
  yInfo += 4
  doc.setFont('helvetica', 'normal')
  doc.text('WhatsApp: (22) 99802-9549', 205, yInfo, { align: 'right' })
  yInfo += 4
  doc.text('Email: contato@facilmateriais.com.br', 205, yInfo, { align: 'right' })
  
  // ============================================
  // TÍTULO DO DOCUMENTO
  // ============================================
  doc.setTextColor(13, 74, 118) // Azul
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PEDIDO DE MATERIAIS DE CONSTRUÇÃO', 105, 52, { align: 'center' })
  
  // Linha decorativa dourada
  doc.setDrawColor(255, 215, 0)
  doc.setLineWidth(1.5)
  doc.line(40, 56, 170, 56)
  
  // ============================================
  // INFORMAÇÕES DO PEDIDO (Caixa cinza)
  // ============================================
  let y = 64
  
  // Fundo cinza claro
  doc.setFillColor(248, 249, 250)
  doc.setDrawColor(222, 226, 230)
  doc.setLineWidth(0.5)
  doc.rect(14, y - 4, 182, 24, 'FD')
  
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  
  // Linha 1: Pedido e Data
  doc.text('Pedido Nº:', 18, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.pedidoId, 40, y)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Data:', 120, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.data, 135, y)
  
  y += 6
  
  // Linha 2: Cliente e Telefone
  doc.setFont('helvetica', 'bold')
  doc.text('Cliente:', 18, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.cliente.nome, 35, y)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Telefone:', 120, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.cliente.telefone, 142, y)
  
  y += 6
  
  // Linha 3: Endereço de Entrega
  doc.setFont('helvetica', 'bold')
  doc.text('Endereço de Entrega:', 18, y)
  doc.setFont('helvetica', 'normal')
  const enderecoCompleto = `${dados.cliente.rua}, ${dados.cliente.numero} - ${dados.cliente.bairro}, ${dados.cliente.cidade}/${dados.cliente.estado}`
  doc.text(enderecoCompleto, 55, y)
  
  y += 6
  
  // Linha 4: CPF
  doc.setFont('helvetica', 'bold')
  doc.text('CPF:', 18, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.cliente.cpf, 28, y)
  
  y += 12
  
  // ============================================
  // TABELA DE ITENS
  // ============================================
  const tableData = dados.itens.map((item, index) => [
    String(index + 1).padStart(2, '0'),
    item.nome,
    item.unidade || 'Unid.',
    item.qtd,
    `R$ ${item.preco.toFixed(2)}`,
    `R$ ${(item.preco * item.qtd).toFixed(2)}`
  ])
  
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Descrição do Material', 'Unidade', 'Qtd', 'Valor Unit.', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 74, 118], // Azul da Fácil
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left', cellWidth: 70 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 30 }
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] // Cinza claro alternado
    }
  })
  
  // ============================================
  // TOTAIS
  // ============================================
  const finalY = (doc as any).lastAutoTable.finalY + 10
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Subtotal:', 140, finalY)
  doc.text(`R$ ${dados.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' })
  
  doc.text('Taxa de Entrega:', 140, finalY + 6)
  doc.text(`R$ ${dados.taxaEntrega.toFixed(2)}`, 190, finalY + 6, { align: 'right' })
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', 140, finalY + 14)
  doc.text(`R$ ${dados.total.toFixed(2)}`, 190, finalY + 14, { align: 'right' })
  
  // ============================================
  // INFORMAÇÕES DE ENTREGA - BOX DESTACADO
  // ============================================
  let yEntrega = finalY + 25
  
  // Caixa com fundo amarelo claro e borda dourada
  doc.setFillColor(255, 248, 220) // Amarelo claro
  doc.setDrawColor(255, 215, 0) // Borda dourada
  doc.setLineWidth(2)
  doc.rect(14, yEntrega - 5, 182, 28, 'FD')
  
  // Título
  doc.setTextColor(13, 74, 118) // Azul
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('📦 INFORMAÇÕES DE ENTREGA', 18, yEntrega + 2)
  
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  yEntrega += 8
  doc.setFont('helvetica', 'bold')
  doc.text('Endereço:', 18, yEntrega)
  doc.setFont('helvetica', 'normal')
  doc.text('Rua Recanto Madureira, 521 – Cantagalo – Rio das Ostras / RJ', 38, yEntrega)
  
  yEntrega += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Horário:', 18, yEntrega)
  doc.setFont('helvetica', 'normal')
  doc.text('Segunda a Sexta, das 08h às 17h', 35, yEntrega)
  
  yEntrega += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Contato:', 18, yEntrega)
  doc.setFont('helvetica', 'normal')
  doc.text('(22) 99802-9549 | (22) 99913-1594', 35, yEntrega)
  
  // ============================================
  // ASSINATURA (APENAS RECEBEDOR)
  // ============================================
  let yAssinatura = 250
  
  // Linha de assinatura
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(60, yAssinatura, 150, yAssinatura)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Assinatura do Recebedor', 105, yAssinatura + 5, { align: 'center' })
  
  yAssinatura += 12
  doc.setFont('helvetica', 'normal')
  doc.text('Data: ____/____/________', 105, yAssinatura, { align: 'center' })
  
  // ============================================
  // RODAPÉ PROFISSIONAL
  // ============================================
  
  // Linha decorativa
  doc.setDrawColor(13, 74, 118)
  doc.setLineWidth(2)
  doc.line(14, 278, 196, 278)
  
  // Fundo azul do rodapé
  doc.setFillColor(13, 74, 118)
  doc.rect(14, 280, 182, 10, 'F')
  
  // Texto do rodapé
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Fácil Material de Construção e Bazar', 105, 285, { align: 'center' })
  
  doc.setTextColor(255, 215, 0) // Dourado
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Estrada Prof. Leandro Farias Sarzedas - Cantagalo, Rio das Ostras/RJ | (22) 99913-1594', 105, 288, { align: 'center' })
  
  return doc
}

// Função auxiliar para converter PDF em Base64 (para email)
export function pdfParaBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1]
}

// Função para converter imagem em Base64 (útil para carregar a logo)
export async function imagemParaBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })
}