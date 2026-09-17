export interface OpenWAConfig {
  apiUrl: string;
  apiKey: string;
  sessionId: string;
  enabled: boolean;
}

const STORAGE_KEY = "el3mmary_openwa_config";

const DEFAULT_CONFIG: OpenWAConfig = {
  apiUrl: (import.meta as any).env?.VITE_OPENWA_URL || "http://localhost:2785",
  apiKey: (import.meta as any).env?.VITE_OPENWA_API_KEY || "",
  sessionId: (import.meta as any).env?.VITE_OPENWA_SESSION || "default",
  enabled: true,
};

export class WhatsAppGatewayService {
  static getConfig(): OpenWAConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Failed to read OpenWA config from storage:", e);
    }
    return DEFAULT_CONFIG;
  }

  static saveConfig(newConfig: Partial<OpenWAConfig>): OpenWAConfig {
    const current = this.getConfig();
    const updated = { ...current, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save OpenWA config to storage:", e);
    }
    return updated;
  }

  /**
   * Formats a phone number for WhatsApp chatId.
   * e.g. "01012345678" -> "201012345678@c.us"
   * e.g. "+201012345678" -> "201012345678@c.us"
   */
  static formatChatId(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("00")) {
      clean = clean.substring(2);
    }
    if (clean.startsWith("01") && clean.length === 11) {
      clean = `2${clean}`;
    } else if (clean.startsWith("0") && !clean.startsWith("20")) {
      clean = `2${clean.substring(1)}`;
    }
    return `${clean}@c.us`;
  }

  /**
   * Tests connection to OpenWA server and checks session status.
   */
  static async testConnection(): Promise<{ ok: boolean; status?: string; message?: string }> {
    const config = this.getConfig();
    const cleanUrl = config.apiUrl.replace(/\/+$/, "");
    const session = encodeURIComponent(config.sessionId.trim() || "default");
    const endpoint = `${cleanUrl}/api/sessions/${session}/status`;

    try {
      const headers: Record<string, string> = {};
      if (config.apiKey.trim()) {
        headers["X-API-Key"] = config.apiKey.trim();
      }

      const res = await fetch(endpoint, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        return {
          ok: false,
          status: String(res.status),
          message: `خطأ من الخادم (${res.status} ${res.statusText})`,
        };
      }

      const data = await res.json().catch(() => null);
      const sessionStatus = data?.status || data?.state || "CONNECTED";

      return {
        ok: true,
        status: sessionStatus,
        message: "تم الاتصال بخادم OpenWA بنجاح",
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message?.includes("Failed to fetch")
          ? "تعذر الوصول إلى خادم OpenWA. تأكد من تشغيل الخادم على الرابط المحدد."
          : err?.message || "خطأ غير متوقع في الاتصال",
      };
    }
  }

  /**
   * Sends a text message to a WhatsApp number via OpenWA REST API.
   */
  static async sendMessage(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const config = this.getConfig();
    if (!config.enabled) {
      return { success: false, error: "خدمة OpenWA معطلة في الإعدادات" };
    }

    const cleanUrl = config.apiUrl.replace(/\/+$/, "");
    const session = encodeURIComponent(config.sessionId.trim() || "default");
    const endpoint = `${cleanUrl}/api/sessions/${session}/messages/send-text`;
    const chatId = this.formatChatId(phone);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.apiKey.trim()) {
        headers["X-API-Key"] = config.apiKey.trim();
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chatId,
          text: message,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const errorMsg = errorJson?.error || errorJson?.message || (await res.text().catch(() => "")) || res.statusText;
        return {
          success: false,
          error: errorMsg,
        };
      }

      const resData = await res.json().catch(() => ({}));
      return {
        success: true,
        messageId: resData?.id || resData?.messageId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message?.includes("Failed to fetch")
          ? "تعذر الاتصال بخادم الواتساب. تأكد من تشغيل الخادم (npm run whatsapp)."
          : err?.message || "خطأ غير متوقع",
      };
    }
  }
}
