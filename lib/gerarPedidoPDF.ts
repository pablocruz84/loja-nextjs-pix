// lib/gerarPedidoPDF.ts

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
  logoBase64?: string // Logo em base64 (opcional)
}

export function gerarPedidoPDF(dados: DadosPedido): jsPDF {
  const doc = new jsPDF()
  
  // ============================================
  // CABEÇALHO COM LOGO E FUNDO AZUL
  // ============================================
  
  // Fundo azul do cabeçalho
  doc.setFillColor(13, 74, 118) // #0d4a76 - cor azul da Fácil
  doc.rect(0, 0, 210, 35, 'F')
  
  // Se tiver logo em base64, adicionar aqui
  if (dados.logoBase64) {
    try {
      // Logo centralizada no topo
      const logoWidth = 80
      const logoHeight = 20
      const logoX = (210 - logoWidth) / 2
      doc.addImage(dados.logoBase64, 'PNG', logoX, 8, logoWidth, logoHeight)
    } catch (error) {
      // Se falhar ao carregar logo, mostrar texto
      doc.setTextColor(255, 204, 0) // Cor amarela
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('FÁCIL', 105, 20, { align: 'center' })
      doc.setFontSize(10)
      doc.text('MATERIAL DE CONSTRUÇÃO E BAZAR', 105, 27, { align: 'center' })
    }
  } else {
    // Texto da logo se não tiver imagem
    doc.setTextColor(255, 204, 0) // Cor amarela/dourada
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('FÁCIL', 105, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text('MATERIAL DE CONSTRUÇÃO E BAZAR', 105, 27, { align: 'center' })
  }
  
  // ============================================
  // TÍTULO DO DOCUMENTO
  // ============================================
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PEDIDO DE MATERIAIS DE CONSTRUÇÃO', 105, 45, { align: 'center' })
  
  // ============================================
  // INFORMAÇÕES DO PEDIDO
  // ============================================
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  let y = 55
  
  doc.text(`Data: ${dados.data}`, 14, y)
  y += 5
  doc.text(`Pedido Nº: ${dados.pedidoId}`, 14, y)
  y += 5
  doc.text(`Solicitante: ${dados.cliente.nome}`, 14, y)
  y += 5
  doc.text(`CPF: ${dados.cliente.cpf}`, 14, y)
  y += 10
  
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
      halign: 'center'
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
    }
  })
  
  // ============================================
  // TOTAIS
  // ============================================
  const finalY = (doc as any).lastAutoTable.finalY + 10
  
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', 140, finalY)
  doc.text(`R$ ${dados.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' })
  
  doc.text('Taxa de Entrega:', 140, finalY + 6)
  doc.text(`R$ ${dados.taxaEntrega.toFixed(2)}`, 190, finalY + 6, { align: 'right' })
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', 140, finalY + 14)
  doc.text(`R$ ${dados.total.toFixed(2)}`, 190, finalY + 14, { align: 'right' })
  
  // ============================================
  // PRAZO DE ENTREGA - DESTAQUE AZUL
  // ============================================
  let yEntrega = finalY + 25
  
  // Caixa com fundo azul claro
  doc.setFillColor(220, 235, 245) // Azul claro
  doc.setDrawColor(13, 74, 118) // Borda azul
  doc.setLineWidth(0.5)
  doc.rect(14, yEntrega - 5, 182, 15, 'FD')
  
  // Texto do prazo
  doc.setTextColor(13, 74, 118) // Azul escuro
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('⏱ PRAZO DE ENTREGA:', 18, yEntrega + 1)
  
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text('O pedido será entregue em até 1 (um) dia útil.', 18, yEntrega + 7)
  
  // ============================================
  // INFORMAÇÕES DE ENTREGA
  // ============================================
  yEntrega += 22
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Informações de Entrega', 14, yEntrega)
  
  yEntrega += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Endereço: ${dados.cliente.rua}, ${dados.cliente.numero} – ${dados.cliente.bairro}`, 14, yEntrega)
  
  yEntrega += 5
  doc.text(`Cidade: ${dados.cliente.cidade} / ${dados.cliente.estado}`, 14, yEntrega)
  
  yEntrega += 5
  doc.text(`Contato: ${dados.cliente.telefone}`, 14, yEntrega)
  
  if (dados.cliente.pontoReferencia) {
    yEntrega += 5
    doc.text(`Referência: ${dados.cliente.pontoReferencia}`, 14, yEntrega)
  }
  
  // ============================================
  // ASSINATURAS
  // ============================================
  let yAssinatura = 250
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(14, yAssinatura, 90, yAssinatura)
  doc.line(120, yAssinatura, 196, yAssinatura)
  
  doc.setFontSize(9)
  doc.text('Nome do Comprador', 14, yAssinatura + 5)
  doc.text('Recebido por:', 120, yAssinatura + 5)
  
  yAssinatura += 15
  doc.line(120, yAssinatura, 196, yAssinatura)
  doc.text('Assinatura', 120, yAssinatura + 5)
  
  // ============================================
  // RODAPÉ
  // ============================================
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Fácil Material de Construção e Bazar', 105, 285, { align: 'center' })
  doc.text('Estrada Professor Leandro Farias Sarzedas - Cantagalo, Rio das Ostras - RJ', 105, 290, { align: 'center' })
  
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