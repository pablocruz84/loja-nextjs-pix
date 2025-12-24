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
}

export function gerarPedidoPDF(dados: DadosPedido): jsPDF {
  const doc = new jsPDF()
  
  // LOGO (se tiver imagem base64, use aqui)
  // doc.addImage(logoBase64, 'PNG', 105, 10, 100, 30)
  
  // TÍTULO COM FUNDO AZUL
  doc.setFillColor(13, 74, 118) // #0d4a76
  doc.rect(0, 10, 210, 25, 'F')
  
  doc.setFontSize(10)
  doc.text('FÁCIL MATERIAL DE CONSTRUÇÃO E BAZAR', 105, 30, { align: 'center' })
  
  // TÍTULO DO DOCUMENTO
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PEDIDO DE MATERIAIS DE CONSTRUÇÃO', 105, 45, { align: 'center' })
  
  // INFORMAÇÕES DO PEDIDO
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
  
  // TABELA DE ITENS
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
      fillColor: [13, 74, 118],
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
  
  // TOTAIS
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
  
  // INFORMAÇÕES DE ENTREGA
  y = finalY + 25
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Informações de Entrega', 14, y)
  
  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${dados.cliente.rua}, ${dados.cliente.numero} – ${dados.cliente.bairro} – ${dados.cliente.cidade} / ${dados.cliente.estado}`, 14, y)
  
  y += 5
  doc.text(`Contato: ${dados.cliente.telefone}`, 14, y)
  
  if (dados.cliente.pontoReferencia) {
    y += 5
    doc.text(`Referência: ${dados.cliente.pontoReferencia}`, 14, y)
  }
  
  // ASSINATURAS
  y = 250
  doc.setDrawColor(0, 0, 0)
  doc.line(14, y, 90, y)
  doc.line(120, y, 196, y)
  
  doc.setFontSize(9)
  doc.text('Nome do Comprador', 14, y + 5)
  doc.text('Recebido por:', 120, y + 5)
  
  y += 15
  doc.line(120, y, 196, y)
  doc.text('Assinatura', 120, y + 5)
  
  // RODAPÉ
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