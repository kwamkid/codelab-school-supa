export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 6, 2026</p>

      <div className="space-y-6 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the CodeLab School Management System operated by CodeLab Thailand,
            you agree to be bound by these Terms of Service. If you do not agree, please do not use
            our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
          <p>
            CodeLab Thailand provides a school management platform that includes student enrollment,
            class management, attendance tracking, parent communication via messaging platforms
            (LINE, Facebook, Instagram), and related educational services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. User Accounts</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must provide accurate and complete information</li>
            <li>You must not share your account with unauthorized users</li>
            <li>You must notify us immediately of any unauthorized access</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the system</li>
            <li>Interfere with or disrupt the service</li>
            <li>Upload malicious content or software</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Messaging Services</h2>
          <p>
            Our platform integrates with third-party messaging services (LINE, Facebook Messenger,
            Instagram). By using these features, you also agree to the terms and policies of those
            respective platforms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Intellectual Property</h2>
          <p>
            All content, features, and functionality of the service are owned by CodeLab Thailand
            and are protected by applicable intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Limitation of Liability</h2>
          <p>
            CodeLab Thailand shall not be liable for any indirect, incidental, or consequential
            damages arising from your use of the service. Our total liability shall not exceed
            the amount paid by you for the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. We will notify users of
            significant changes. Continued use of the service constitutes acceptance of the
            updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Contact Us</h2>
          <p>
            For questions about these Terms of Service, please contact us at:{" "}
            <a href="mailto:contact@codelabthailand.com" className="text-blue-600 underline">
              contact@codelabthailand.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
