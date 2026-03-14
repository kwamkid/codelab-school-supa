export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 14, 2026</p>

      <div className="space-y-6 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p>
            This Privacy Policy is provided by <strong>KID POWER COMPANY LIMITED</strong> (Tax ID: 0105567222067),
            located at 9 Rama II Road, Tha Kham, Bang Khun Thian, Bangkok 10150, Thailand
            (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
          </p>
          <p className="mt-2">
            We operate the CodeLab Thailand School Management System
            at <a href="https://app.codelabthailand.com" className="text-blue-600 underline">app.codelabthailand.com</a> and
            the website <a href="https://codelabthailand.com" className="text-blue-600 underline">codelabthailand.com</a>.
            This Privacy Policy explains how we collect, use, store, and protect your personal information
            when you use our services, including interactions through Facebook, Instagram, and LINE.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Account information:</strong> name, email address, phone number</li>
            <li><strong>Student information:</strong> name, nickname, date of birth, age, grade level, school name</li>
            <li><strong>Communication data:</strong> messages sent and received through Facebook Messenger, Instagram Direct, or LINE</li>
            <li><strong>Social media profile data:</strong> Facebook/Instagram display name, profile picture, and Page interaction data</li>
            <li><strong>Usage data:</strong> pages visited, features used, and interaction timestamps</li>
            <li><strong>Payment information:</strong> payment method and transaction records (we do not store credit card numbers)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To manage student enrollments, classes, schedules, and attendance</li>
            <li>To communicate with parents and students via Facebook Messenger, Instagram, or LINE</li>
            <li>To send notifications about classes, events, schedule changes, and makeup classes</li>
            <li>To process payments and generate receipts and invoices</li>
            <li>To respond to inquiries received through our Facebook Page or Instagram account</li>
            <li>To improve our services and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Facebook and Instagram Data</h2>
          <p>
            Our application integrates with Meta platforms (Facebook and Instagram) to provide
            messaging and communication features. Specifically, we use:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Facebook Pages Messaging:</strong> to receive and respond to messages from parents on our Facebook Page</li>
            <li><strong>Instagram Messaging:</strong> to receive and respond to direct messages on our Instagram account</li>
            <li><strong>Page Management:</strong> to manage our business page and read engagement metrics</li>
          </ul>
          <p className="mt-2">
            We only access Facebook and Instagram data that users voluntarily share with us by
            messaging our Page or interacting with our content. We do not sell or share this data
            with any third parties. Data from Meta platforms is used solely for the purpose of
            communicating with parents and managing our educational services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Third-Party Services</h2>
          <p>
            We integrate with the following third-party services to provide our features:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Meta (Facebook / Instagram)</strong> — for page messaging, notifications, and engagement tracking</li>
            <li><strong>LINE Messaging API</strong> — for sending notifications and chat with parents</li>
            <li><strong>Supabase</strong> — for secure data storage</li>
            <li><strong>Firebase (Google)</strong> — for user authentication</li>
          </ul>
          <p className="mt-2">
            Each of these services has its own privacy policy. We only share the minimum data
            necessary to provide our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to
            provide our services. Messaging data from Facebook and Instagram is retained for
            up to 24 months for customer service purposes. You may request deletion of your
            data at any time (see Section 9 below).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Data Security</h2>
          <p>
            We implement appropriate technical and organizational security measures to protect
            your personal information, including:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Encryption of data in transit (HTTPS/TLS) and at rest</li>
            <li>Role-based access controls for administrative users</li>
            <li>Regular security reviews and monitoring</li>
            <li>Secure authentication via Firebase with multi-factor support</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Access your personal data that we hold</li>
            <li>Request correction of inaccurate or incomplete data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for data processing at any time</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Data Deletion</h2>
          <p>
            You may request deletion of your personal data at any time. To submit a data
            deletion request:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              Visit our <a href="/data-deletion" className="text-blue-600 underline">Data Deletion Request page</a>
            </li>
            <li>
              Or email us at{" "}
              <a href="mailto:contact@codelabthailand.com" className="text-blue-600 underline">
                contact@codelabthailand.com
              </a>{" "}
              with the subject &quot;Data Deletion Request&quot;
            </li>
          </ul>
          <p className="mt-2">
            We will process your request within 30 days. Upon deletion, all your personal data,
            including any data obtained through Facebook or Instagram, will be permanently removed
            from our systems.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of any
            material changes by posting the new policy on this page with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data rights,
            please contact us:
          </p>
          <ul className="list-none pl-0 space-y-1 mt-2">
            <li><strong>Company:</strong> KID POWER COMPANY LIMITED</li>
            <li><strong>Address:</strong> 9 Rama II Road, Tha Kham, Bang Khun Thian, Bangkok 10150, Thailand</li>
            <li><strong>Email:</strong>{" "}
              <a href="mailto:contact@codelabthailand.com" className="text-blue-600 underline">
                contact@codelabthailand.com
              </a>
            </li>
            <li><strong>Website:</strong>{" "}
              <a href="https://codelabthailand.com" className="text-blue-600 underline">
                codelabthailand.com
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
