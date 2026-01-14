import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;

export interface CheckPdfData {
  checkDate: string;
  productName: string;
  alitracer: string;
  reference: string;
  lockerNumber: number;
  status: number;
  comment: string;
  controlledBy: string;
  brand: string;
  cmu: string;
  size: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor(
    private httpClient: HttpClient,
  ) {}

  /**
   * Génère le PDF et le sauvegarde sur le backend (SANS téléchargement auto)
   */
  async generateAndSavePdf(data: CheckPdfData): Promise<any> {
    const docDefinition: any = {
      content: [
        {
          text: 'Rapport de Contrôle OptiBox',
          fontSize: 20,
          bold: true,
          alignment: 'center',
          marginBottom: 30,
          color: '#2563eb'
        },
        {
          table: {
            widths: ['40%', '60%'],
            body: [
              [
                { text: 'Date du contrôle', bold: true, fillColor: '#f3f4f6' },
                {
                  text: new Date(data.checkDate).toLocaleString('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                  })
                }
              ],
              [
                { text: 'Contrôlé par', bold: true, fillColor: '#f3f4f6' },
                { text: data.controlledBy }
              ],
              [
                { text: 'Produit', bold: true, fillColor: '#f3f4f6' },
                { text: data.productName }
              ],
              [
                { text: 'Marque', bold: true, fillColor: '#f3f4f6' },
                { text: data.brand || 'N/A' }
              ],
              [
                { text: 'Taille', bold: true, fillColor: '#f3f4f6' },
                { text: data.size || 'N/A' }
              ],
              [
                { text: 'CMU', bold: true, fillColor: '#f3f4f6' },
                { text: data.cmu || 'N/A' }
              ],
              [
                { text: 'Référence', bold: true, fillColor: '#f3f4f6' },
                { text: data.reference || 'N/A' }
              ],
              [
                { text: 'Alitracer', bold: true, fillColor: '#f3f4f6' },
                { text: data.alitracer || 'N/A' }
              ],
              [
                { text: 'Casier N°', bold: true, fillColor: '#f3f4f6' },
                { text: data.lockerNumber.toString() }
              ],
              [
                { text: 'État du stock', bold: true, fillColor: '#f3f4f6' },
                {
                  text: this.getStatusLabel(data.status),
                  color: this.getStatusColor(data.status),
                  bold: true,
                  fontSize: 12
                }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          marginBottom: 20
        },
        {
          text: 'Commentaires du contrôle',
          fontSize: 14,
          bold: true,
          marginBottom: 10,
          color: '#374151'
        },
        {
          table: {
            widths: ['100%'],
            body: [[
              {
                text: data.comment || 'Aucun commentaire',
                fontSize: 11,
                margin: [5, 5, 5, 5]
              }
            ]]
          },
          layout: 'lightHorizontalLines',
          marginBottom: 30
        },
        {
          text: `Document généré automatiquement par OptiBox le ${new Date().toLocaleString('fr-FR')}`,
          fontSize: 8,
          alignment: 'center',
          marginTop: 40,
          color: '#9ca3af'
        }
      ],
      pageMargins: [40, 40, 40, 40],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10
      }
    };

    // ✅ Format de date lisible : 09-01-2026
    const dateFormatted = this.formatDateForFilename(data.checkDate);
    const filename = `Controle_${data.alitracer || data.reference}_${dateFormatted}.pdf`;

    // ✅ NE TÉLÉCHARGE PAS automatiquement
    // pdfMake.createPdf(docDefinition).download(filename);

    // Sauvegarde sur backend
    return new Promise((resolve, reject) => {
      pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('stockId', data.lockerNumber.toString());
        formData.append('checkDate', data.checkDate);
        formData.append('alitracer', data.alitracer);

        this.httpClient.post('api/pdf/save', formData).subscribe({
          next: (result: any) => resolve(result),
          error: (error) => reject(error)
        });
      });
    });
  }

  /**
   * Formate une date ISO en format lisible pour nom de fichier
   * Exemple: "2026-01-09T08:30:00.000Z" → "09-01-2026"
   */
  private formatDateForFilename(isoDate: string): string {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private getStatusLabel(status: number): string {
    const statusMap: { [key: number]: string } = {
      0: 'NOK',
      1: 'OK',
      2: 'HS',
    };
    return statusMap[status] || 'Statut inconnu';
  }

  private getStatusColor(status: number): string {
    const colorMap: { [key: number]: string } = {
      0: '#f59e0b',
      1: '#10b981',
      2: '#ef4444',
    };
    return colorMap[status] || '#000000';
  }
}
