import { PrintType } from '../../Printers/Schemas/printer.schema';
import { PrintTemplatesResponse } from '../../PrimeApi/Services/prime-api.service';
import { DefaultPrintTemplate } from './print-template.data';

type PrintTemplateData = PrintTemplatesResponse['data'];

export function getPrintTemplateConfig(
  type: PrintType,
  locationId?: number,
  printTemplate?: PrintTemplateData | undefined,
): Record<string, unknown> {
  if (type === PrintType.Bill) {
    const billTemplates = printTemplate?.order_invoice_templates ?? [];
    for (const template of billTemplates) {
      if (template.location_ids?.some((id) => id === locationId)) {
        return { ...template.config, brandLogos: printTemplate?.brand_logos };
      }
    }
    return {
      defaultConfig: true,
      brandLogos: printTemplate?.brand_logos || [],
      ...(printTemplate?.order_invoice_default_config ||
        DefaultPrintTemplate.order_invoice_default_config),
    };
  }

  if (type === PrintType.Kot) {
    const kotTemplates = printTemplate?.order_kot_templates ?? [];
    for (const template of kotTemplates) {
      if (template.location_ids?.some((id) => id === locationId)) {
        return { ...template.config, brandLogos: printTemplate?.brand_logos };
      }
    }
    return {
      defaultConfig: true,
      brandLogos: printTemplate?.brand_logos || [],
      ...(printTemplate?.order_kot_default_config ||
        DefaultPrintTemplate.order_kot_default_config),
    };
  }

  return {};
}
