export default function DataDeletionPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Data Deletion Request</h1>
      <p className="text-sm text-muted-foreground mb-8">
        CodeLab Thailand — KID POWER COMPANY LIMITED
      </p>

      <div className="space-y-6 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">How to Request Data Deletion</h2>
          <p>
            If you would like to request the deletion of your personal data from our systems,
            including any data collected through Facebook, Instagram, or LINE, please follow
            the steps below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Option 1: Email Request</h2>
          <p>
            Send an email to{" "}
            <a href="mailto:contact@codelabthailand.com?subject=Data%20Deletion%20Request" className="text-blue-600 underline">
              contact@codelabthailand.com
            </a>{" "}
            with the following information:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Subject: &quot;Data Deletion Request&quot;</li>
            <li>Your full name</li>
            <li>Phone number or email associated with your account</li>
            <li>Facebook or Instagram username (if applicable)</li>
            <li>A brief description of the data you want deleted</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Option 2: Facebook Message</h2>
          <p>
            You can also send a message to our{" "}
            <a href="https://www.facebook.com/codelabthailand" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
              CodeLab Thailand Facebook Page
            </a>{" "}
            requesting data deletion. Please include your name and contact information so we can
            identify your records.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">What Data Will Be Deleted</h2>
          <p>Upon receiving your request, we will delete:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Your account and profile information</li>
            <li>Student records associated with your account</li>
            <li>Message history from Facebook Messenger and Instagram Direct</li>
            <li>Enrollment and attendance records</li>
            <li>Payment transaction records (subject to legal retention requirements)</li>
          </ul>
          <p className="mt-2">
            Note: Some data may be retained as required by Thai law for tax and accounting
            purposes (up to 5 years for financial records).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Processing Time</h2>
          <p>
            We will acknowledge your request within 7 days and complete the deletion within
            30 days. You will receive a confirmation email once the process is complete.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Contact Information</h2>
          <ul className="list-none pl-0 space-y-1">
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
