// app/api/enviar-pedido/route.ts

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { pedidoId, nomeCliente, pdfBase64 } = await request.json()

    // Configurar transportador de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_REMETENTE,
        pass: process.env.EMAIL_SENHA
      }
    })

    // Enviar email
    await transporter.sendMail({
      from: `"Fácil Material de Construção" <${process.env.EMAIL_REMETENTE}>`,
      to: process.env.EMAIL_DESTINATARIO,
      subject: `🛒 Novo Pedido #${pedidoId} - ${nomeCliente}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0d4a76; padding: 20px; text-align: center;">
            <h1 style="color: #F4CA3E; margin: 0;">FÁCIL</h1>
            <p style="color: white; margin: 5px 0;">Material de Construção e Bazar</p>
          </div>
          
          <div style="padding: 20px; background: #f5f5f5;">
            <h2 style="color: #0d4a76;">Novo Pedido Recebido!</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>Pedido Nº:</strong> ${pedidoId}</p>
              <p><strong>Cliente:</strong> ${nomeCliente}</p>
              <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            
            <p style="color: #666;">
              O pedido completo está em anexo no formato PDF.
            </p>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0;">
              <p style="margin: 0;"><strong>⚠️ Ação Necessária:</strong></p>
              <p style="margin: 5px 0 0 0;">Verifique o pedido e entre em contato com o cliente para confirmar a entrega.</p>
            </div>
          </div>
          
          <div style="background: #0d4a76; padding: 15px; text-align: center;">
            <p style="color: white; font-size: 12px; margin: 0;">
              Fácil Material de Construção e Bazar<br>
              Estrada Professor Leandro Farias Sarzedas<br>
              Cantagalo, Rio das Ostras - RJ<br>
              (22) 99913-1594
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `pedido-${pedidoId}.pdf`,
          content: pdfBase64,
          encoding: 'base64'
        }
      ]
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Erro ao enviar email:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar email', details: error.message },
      { status: 500 }
    )
  }
}