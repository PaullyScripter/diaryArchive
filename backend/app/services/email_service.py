import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Transactional email delivery for DiaryArchive.

    Delivery is driven by SMTP settings (EMAIL_PROVIDER/SMTP_HOST/...). When no
    provider is configured the service is disabled: it logs the message it would
    have sent so local/development flows stay observable, and every caller keeps
    working. Delivery failures are caught and logged so a broken mailer never
    breaks an auth flow (password reset / email verification tokens remain valid
    and can be delivered once email is configured).
    """

    @property
    def enabled(self) -> bool:
        return bool(settings.email_provider and settings.smtp_host)

    def _new_message(self, to_email: str, subject: str, text_body: str) -> EmailMessage:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.email_from or "DiaryArchive"
        msg["To"] = to_email
        msg.set_content(text_body)
        return msg

    def _smtp_send(self, msg: EmailMessage) -> None:
        host = settings.smtp_host
        port = settings.smtp_port
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.ehlo()
            if settings.smtp_starttls:
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

    async def send_email(self, to_email: str, subject: str, text_body: str) -> bool:
        if not self.enabled:
            logger.info(
                "Email delivery disabled (no SMTP provider configured); would send to %s "
                "subject=%r body=%r",
                to_email,
                subject,
                text_body,
            )
            return False
        msg = self._new_message(to_email, subject, text_body)
        try:
            await asyncio.to_thread(self._smtp_send, msg)
        except Exception:
            logger.exception("Failed to deliver email to %s (subject=%r)", to_email, subject)
            return False
        logger.info("Delivered email to %s (subject=%r)", to_email, subject)
        return True


email_service = EmailService()