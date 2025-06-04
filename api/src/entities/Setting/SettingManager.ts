import { SettingKey } from "./SettingType";
import { SettingEntity } from "./SettingEntity";

export default class SettingManager {
  static async getSetting(key: SettingKey): Promise<SettingEntity | null> {
    return SettingEntity.findOne({
      where: { key },
    });
  }

  static async getNextInvoiceNumber(): Promise<number> {
    const setting = await SettingManager.getSetting(SettingKey.INVOICE_NUMBER);
    if (!setting) {
      throw new Error(
        `Setting with key ${SettingKey.INVOICE_NUMBER} not found.`,
      );
    }

    const currentValue = parseFloat(setting.value) + 1;
    setting.value = currentValue.toString();
    await setting.save();

    return currentValue;
  }
}
