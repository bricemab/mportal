import { SettingKey } from "./SettingType";
import { SettingEntity } from "./SettingEntity";

export default class SettingManager {
  static async getSetting(key: SettingKey): Promise<SettingEntity | null> {
    return SettingEntity.findOne({
      where: { key },
    });
  }

  static async getNextInvoiceNumber(): Promise<string> {
    const setting = await SettingManager.getSetting(SettingKey.INVOICE_NUMBER);
    if (!setting) {
      throw new Error(
        `Setting with key ${SettingKey.INVOICE_NUMBER} not found.`,
      );
    }

    function invoiceNumber() {
      const date = new Date();
      const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
      const randomPart = Math.random().toString(16).substr(2, 8).toUpperCase();
      return `FAC-${datePart}-${randomPart}`;
    }

    const currentValue = invoiceNumber();
    setting.value = currentValue;
    await setting.save();

    return currentValue;
  }
}
