// lib/gerarPedidoPDF.ts - VERSÃO MINIMALISTA (SEM BORDAS, APENAS ALINHADO)

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
  // CABEÇALHO SIMPLES E ALINHADO
  // ============================================
  
  // Logo centralizado
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('FÁCIL', 105, 20, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Material de Construção e Bazar', 105, 27, { align: 'center' })
  
  // Linha simples separadora
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(15, 30, 195, 30)
  
  // Informações da empresa em uma linha
  doc.setFontSize(8)
  doc.text('Estrada Prof. Leandro Farias Sarzedas - Cantagalo, RJ  |  Tel: (22) 99913-1594  |  WhatsApp: (22) 99802-9549', 105, 35, { align: 'center' })
  
  doc.line(15, 37, 195, 37)
  
  // ============================================
  // TÍTULO
  // ============================================
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PEDIDO DE MATERIAIS', 105, 48, { align: 'center' })
  
  // ============================================
  // INFORMAÇÕES DO PEDIDO (ALINHADAS)
  // ============================================
  
  let y = 58
  doc.setFontSize(10)
  
  // Linha 1: Pedido e Data (alinhados)
  doc.setFont('helvetica', 'bold')
  doc.text('Pedido Nº:', 15, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.pedidoId, 40, y)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Data:', 150, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.data, 165, y)
  
  y += 7
  
  // Linha 2: Cliente e CPF
  doc.setFont('helvetica', 'bold')
  doc.text('Cliente:', 15, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.cliente.nome, 40, y)
  
  doc.setFont('helvetica', 'bold')
  doc.text('CPF:', 150, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.cliente.cpf, 165, y)
  
  y += 7
  
  // Linha 3: Telefone
  doc.setFont('helvetica', 'bold')
  doc.text('Telefone:', 15, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.cliente.telefone, 40, y)
  
  y += 7
  
  // Linha 4: Endereço
  doc.setFont('helvetica', 'bold')
  doc.text('Endereço:', 15, y)
  doc.setFont('helvetica', 'normal')
  const endereco = `${dados.cliente.rua}, ${dados.cliente.numero} - ${dados.cliente.bairro}, ${dados.cliente.cidade}/${dados.cliente.estado}`
  doc.text(endereco, 40, y)
  
  // Linha separadora
  y += 5
  doc.setLineWidth(0.3)
  doc.line(15, y, 195, y)
  
  y += 8
  
  // ============================================
  // TABELA DE ITENS (SIMPLES E LIMPA)
  // ============================================
  
  const tableData = dados.itens.map((item, index) => [
    String(index + 1).padStart(2, '0'),
    item.nome,
    item.unidade || 'Unid.',
    item.qtd.toString(),
    `R$ ${item.preco.toFixed(2)}`,
    `R$ ${(item.preco * item.qtd).toFixed(2)}`
  ])
  
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Descrição', 'Unidade', 'Qtd', 'Valor Unit.', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left', cellWidth: 75 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 30 }
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    bodyStyles: {
      textColor: [0, 0, 0]
    }
  })
  
  // ============================================
  // TOTAIS (ALINHADOS À DIREITA)
  // ============================================
  
  const finalY = (doc as any).lastAutoTable.finalY + 10
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  // Subtotal
  doc.text('Subtotal:', 145, finalY)
  doc.text(`R$ ${dados.subtotal.toFixed(2)}`, 195, finalY, { align: 'right' })
  
  // Taxa de Entrega
  doc.text('Taxa de Entrega:', 145, finalY + 6)
  doc.text(`R$ ${dados.taxaEntrega.toFixed(2)}`, 195, finalY + 6, { align: 'right' })
  
  // Linha separadora
  doc.setLineWidth(0.3)
  doc.line(145, finalY + 8, 195, finalY + 8)
  
  // Total
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', 145, finalY + 14)
  doc.text(`R$ ${dados.total.toFixed(2)}`, 195, finalY + 14, { align: 'right' })
  
  // Linha dupla abaixo do total
  doc.setLineWidth(0.5)
  doc.line(145, finalY + 16, 195, finalY + 16)
  
  // ============================================
  // INFORMAÇÕES DE ENTREGA
  // ============================================
  
  let yEntrega = finalY + 28
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMAÇÕES DE ENTREGA', 15, yEntrega)
  
  doc.setLineWidth(0.3)
  doc.line(15, yEntrega + 1, 195, yEntrega + 1)
  
  yEntrega += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Endereço:', 15, yEntrega)
  doc.setFont('helvetica', 'normal')
  doc.text('Rua Recanto Madureira, 521 – Cantagalo – Rio das Ostras / RJ', 40, yEntrega)
  
  yEntrega += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Horário:', 15, yEntrega)
  doc.setFont('helvetica', 'normal')
  doc.text('Segunda a Sexta, das 08h às 17h', 40, yEntrega)
  
  yEntrega += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Contato:', 15, yEntrega)
  doc.setFont('helvetica', 'normal')
  doc.text('(22) 99802-9549  |  (22) 99913-1594', 40, yEntrega)
  
  // ============================================
  // ASSINATURA (SIMPLES E ALINHADA)
  // ============================================
  
  let yAssinatura = 255
  
  // Recebedor
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('RECEBIDO POR:', 15, yAssinatura)
  
  yAssinatura += 10
  doc.setLineWidth(0.3)
  doc.line(15, yAssinatura, 80, yAssinatura)
  
  yAssinatura += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Assinatura', 15, yAssinatura)
  
  yAssinatura += 8
  doc.line(15, yAssinatura, 50, yAssinatura)
  doc.text('Data: ____/____/________', 15, yAssinatura + 4)
  
  // Observações (ao lado)
  yAssinatura = 255
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('OBSERVAÇÕES:', 110, yAssinatura)
  
  doc.setFont('helvetica', 'normal')
  doc.setLineWidth(0.1)
  doc.line(110, yAssinatura + 6, 195, yAssinatura + 6)
  doc.line(110, yAssinatura + 12, 195, yAssinatura + 12)
  doc.line(110, yAssinatura + 18, 195, yAssinatura + 18)
  doc.line(110, yAssinatura + 24, 195, yAssinatura + 24)
  
  // ============================================
  // RODAPÉ SIMPLES
  // ============================================
  
  doc.setLineWidth(0.3)
  doc.line(15, 285, 195, 285)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('FÁCIL - Material de Construção e Bazar', 105, 289, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Cantagalo, Rio das Ostras/RJ  |  (22) 99913-1594  |  (22) 99802-9549', 105, 292, { align: 'center' })
  
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