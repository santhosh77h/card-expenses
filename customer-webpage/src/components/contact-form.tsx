"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Loader2, AlertCircle } from "lucide-react";

import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trackContactFormSubmit } from "@/lib/analytics";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SUBJECT_KEYS = [
  "feedback",
  "bugReport",
  "featureRequest",
  "generalQuery",
  "other",
] as const;

type FormData = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;
type Status = "idle" | "submitting" | "success" | "error";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ContactForm() {
  const t = useTranslations("contact");
  const { theme } = useTheme();

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>("idle");

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = t("validation.nameRequired");
    if (!form.email.trim()) errs.email = t("validation.emailRequired");
    else if (!validateEmail(form.email)) errs.email = t("validation.emailInvalid");
    if (!form.subject) errs.subject = t("validation.subjectRequired");
    if (!form.message.trim()) errs.message = t("validation.messageRequired");
    else if (form.message.trim().length < 10) errs.message = t("validation.messageMinLength");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus("submitting");

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to send");

      trackContactFormSubmit(form.subject);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function resetForm() {
    setForm({ name: "", email: "", subject: "", message: "" });
    setErrors({});
    setStatus("idle");
  }

  return (
    <MagicCard
      gradientColor={theme === "dark" ? "#262626" : "#D9D9D955"}
      gradientFrom="oklch(0.765 0.177 163.2)"
      gradientTo="oklch(0.765 0.177 163.2 / 0.3)"
      className="relative rounded-2xl p-0"
    >
      <BorderBeam
        size={200}
        duration={8}
        colorFrom="oklch(0.765 0.177 163.2)"
        colorTo="oklch(0.765 0.177 163.2 / 0.4)"
        borderWidth={1.5}
      />

      <div className="p-6 sm:p-8">
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              >
                <CheckCircle2 className="h-16 w-16 text-primary mb-4" />
              </motion.div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {t("success.title")}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {t("success.description")}
              </p>
              <Button variant="outline" size="lg" onClick={resetForm}>
                {t("success.sendAnother")}
              </Button>
            </motion.div>
          ) : status === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <AlertCircle className="h-16 w-16 text-destructive mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {t("error.title")}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {t("error.description")}
              </p>
              <Button variant="outline" size="lg" onClick={() => setStatus("idle")}>
                {t("error.retry")}
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-6"
              noValidate
            >
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="contact-name">{t("form.name")}</Label>
                <Input
                  id="contact-name"
                  type="text"
                  placeholder={t("form.namePlaceholder")}
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="contact-email">{t("form.email")}</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder={t("form.emailPlaceholder")}
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  aria-invalid={!!errors.email}
                  className="h-10"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="contact-subject">{t("form.subject")}</Label>
                <div className="relative">
                  <select
                    id="contact-subject"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    aria-invalid={!!errors.subject}
                    className={`h-10 w-full appearance-none rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none transition-colors md:text-sm
                      ${errors.subject
                        ? "border-destructive ring-3 ring-destructive/20"
                        : "border-input focus:border-ring focus:ring-3 focus:ring-ring/50"
                      }
                      ${!form.subject ? "text-muted-foreground" : "text-foreground"}
                      dark:bg-input/30
                    `}
                  >
                    <option value="" disabled>
                      {t("form.subjectPlaceholder")}
                    </option>
                    {SUBJECT_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`subjects.${key}`)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                {errors.subject && (
                  <p className="text-xs text-destructive">{errors.subject}</p>
                )}
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="contact-message">{t("form.message")}</Label>
                <Textarea
                  id="contact-message"
                  placeholder={t("form.messagePlaceholder")}
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  aria-invalid={!!errors.message}
                  rows={5}
                  className="min-h-[120px] resize-y"
                />
                {errors.message && (
                  <p className="text-xs text-destructive">{errors.message}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                disabled={status === "submitting"}
                className="w-full h-11 rounded-full text-base font-semibold"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("form.submitting")}
                  </>
                ) : (
                  t("form.submit")
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </MagicCard>
  );
}
