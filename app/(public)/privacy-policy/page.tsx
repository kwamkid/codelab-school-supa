export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 6, 2026</p>

      <div className="space-y-6 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p>
            CodeLab Thailand (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the CodeLab School
            Management System. This Privacy Policy explains how we collect, use, and protect your
            personal information when you use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Account information: name, email, phone number</li>
            <li>Student information: name, age, grade level, school</li>
            <li>Communication data: messages sent through LINE, Facebook Messenger, or Instagram</li>
            <li>Usage data: pages visited, features used, and interaction timestamps</li>
            <li>Social media profile: display name and avatar from connected platforms</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To manage student enrollments, classes, and attendance</li>
            <li>To communicate with parents via LINE, Facebook, or Instagram messaging</li>
            <li>To send notifications about classes, events, and schedules</li>
            <li>To improve our services and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Third-Party Services</h2>
          <p>
            We integrate with the following third-party services to provide our features:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>LINE Messaging API — for sending notifications and chat</li>
            <li>Facebook / Instagram (Meta) — for page messaging and communication</li>
            <li>Supabase — for data storage and authentication</li>
            <li>Firebase — for user authentication</li>
          </ul>
          <p className="mt-2">
            These services have their own privacy policies. We only share the minimum data necessary
            to provide our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to
            provide our services. You may request deletion of your data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal information,
            including encryption in transit and at rest, access controls, and regular security reviews.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for data processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at:{" "}
            <a href="mailto:contact@codelabthailand.com" className="text-blue-600 underline">
              contact@codelabthailand.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
