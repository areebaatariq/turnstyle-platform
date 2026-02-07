import sgMail from '@sendgrid/mail';

// Email service using SendGrid – read env at runtime so dotenv has always run first
function getSendGridKey() {
  return process.env.SENDGRID_API_KEY;
}
function getFromEmail() {
  return process.env.FROM_EMAIL || 'noreply@turnstyle.com';
}

/** Link to optional client style questionnaire; responses can be synced to client profile via form-response API */
const CLIENT_STYLE_FORM_URL = process.env.CLIENT_STYLE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSd8T1RsqEtwPn2T_Fol7Mk7J91VN0ZIHSe9SvI2oHIUOTAzDw/viewform';

interface SendInvitationEmailParams {
  to: string;
  clientName: string;
  stylistName: string;
  inviteLink: string;
  customMessage?: string;
}

/**
 * Send invitation email to client
 */
export async function sendInvitationEmail({
  to,
  clientName,
  stylistName,
  inviteLink,
  customMessage,
}: SendInvitationEmailParams): Promise<void> {
  const SENDGRID_API_KEY = getSendGridKey();
  const FROM_EMAIL = getFromEmail();
  try {
    if (!SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY environment variable is required');
    }
    sgMail.setApiKey(SENDGRID_API_KEY);

    console.log('📧 Attempting to send invitation email...');
    console.log('   To:', to);
    console.log('   From:', FROM_EMAIL);
    console.log('   Client Name:', clientName);
    console.log('   Stylist Name:', stylistName);
    console.log('   Invite Link:', inviteLink);

    const emailBody = `
Hi ${clientName},

${customMessage || `You've been invited by ${stylistName} to join their styling platform.`}

You'll be able to:
- View your digital closet
- Receive styling recommendations
- Collaborate with your stylist

Click the link below to accept the invitation:
${inviteLink}

To help us personalize your experience, please take a moment to share more about your style (optional):
${CLIENT_STYLE_FORM_URL}

Looking forward to working with you!

Best regards,
${stylistName}
    `.trim();

    const msg = {
      to,
      from: FROM_EMAIL,
      subject: `Invitation from ${stylistName} - Join Turnstyle`,
      text: emailBody,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${clientName},</h2>
          <p style="color: #666; line-height: 1.6;">
            ${customMessage ? customMessage.replace(/\n/g, '<br/>') : `You've been invited by <strong>${stylistName}</strong> to join their styling platform.`}
          </p>
          <p style="color: #666; line-height: 1.6;">
            You'll be able to:
          </p>
          <ul style="color: #666; line-height: 1.8;">
            <li>View your digital closet</li>
            <li>Receive styling recommendations</li>
            <li>Collaborate with your stylist</li>
          </ul>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${inviteLink}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            Or copy and paste this link into your browser:<br/>
            <a href="${inviteLink}" style="color: #007bff;">${inviteLink}</a>
          </p>
          <p style="color: #666; line-height: 1.6; margin-top: 24px;">
            To help us personalize your experience, please share more about your style (optional):<br/>
            <a href="${CLIENT_STYLE_FORM_URL}" style="color: #007bff;">Complete the style questionnaire</a>
          </p>
          <p style="color: #666; margin-top: 30px;">
            Looking forward to working with you!<br/>
            <strong>${stylistName}</strong>
          </p>
        </div>
      `,
    };

    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully!');
    console.log('   SendGrid response status:', response[0]?.statusCode);
    console.log('   SendGrid response headers:', JSON.stringify(response[0]?.headers, null, 2));
  } catch (error: any) {
    console.error('❌ Error sending invitation email:');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    
    if (error.response) {
      console.error('   SendGrid status code:', error.response.statusCode);
      console.error('   SendGrid error body:', JSON.stringify(error.response.body, null, 2));
      
      // Extract specific SendGrid error messages
      if (error.response.body?.errors) {
        error.response.body.errors.forEach((err: any) => {
          console.error(`   - ${err.field}: ${err.message}`);
        });
      }
    }
    
    // Provide more helpful error messages
    if (error.code === 'UNAUTHORIZED' || error.response?.statusCode === 401) {
      throw new Error('SendGrid API key is invalid or unauthorized');
    } else if (error.response?.statusCode === 403) {
      throw new Error('SendGrid API key does not have permission to send emails');
    } else if (error.response?.body?.errors?.[0]?.message?.includes('from')) {
      throw new Error(`The sender email "${FROM_EMAIL}" is not verified in SendGrid. Please verify it in your SendGrid account.`);
    }
    
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
}

/**
 * Send look approval notification email to client
 */
export async function sendLookApprovalEmail({
  to,
  clientName,
  stylistName,
  lookName,
  lookLink,
  customMessage,
}: {
  to: string;
  clientName: string;
  stylistName: string;
  lookName: string;
  lookLink: string;
  customMessage?: string;
}): Promise<void> {
  const apiKey = getSendGridKey();
  const fromEmail = getFromEmail();
  try {
    if (!apiKey) {
      console.error('❌ SENDGRID_API_KEY check failed. process.env.SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');
      throw new Error('SENDGRID_API_KEY environment variable is required');
    }
    sgMail.setApiKey(apiKey);
    
    console.log('📧 Attempting to send look approval notification email...');
    console.log('   To:', to);
    console.log('   From:', fromEmail);
    console.log('   Client Name:', clientName);
    console.log('   Stylist Name:', stylistName);
    console.log('   Look Name:', lookName);
    console.log('   Look Link:', lookLink);

    const emailBody = `
Hi ${clientName},

${customMessage || `${stylistName} has created a new styling look for you and needs your approval.`}

Look: ${lookName}

${customMessage ? '' : 'You can review the look and approve it or request changes.'}

View the look and provide your feedback:
${lookLink}

Thank you!

Best regards,
${stylistName}
    `.trim();

    const msg = {
      to,
      from: fromEmail,
      subject: `New Look for Review: ${lookName} - ${stylistName}`,
      text: emailBody,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${clientName},</h2>
          <p style="color: #666; line-height: 1.6;">
            ${customMessage ? customMessage.replace(/\n/g, '<br/>') : `<strong>${stylistName}</strong> has created a new styling look for you and needs your approval.`}
          </p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${lookName}</h3>
            ${customMessage ? '' : '<p style="color: #666; margin-bottom: 0;">You can review the look and approve it or request changes.</p>'}
          </div>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${lookLink}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Review Look
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            Or copy and paste this link into your browser:<br/>
            <a href="${lookLink}" style="color: #007bff;">${lookLink}</a>
          </p>
          <p style="color: #666; margin-top: 30px;">
            Thank you!<br/>
            <strong>${stylistName}</strong>
          </p>
        </div>
      `,
    };

    const response = await sgMail.send(msg);
    console.log('✅ Look approval email sent successfully!');
    console.log('   SendGrid response status:', response[0]?.statusCode);
  } catch (error: any) {
    console.error('❌ Error sending look approval email:');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    
    if (error.response) {
      console.error('   SendGrid status code:', error.response.statusCode);
      console.error('   SendGrid error body:', JSON.stringify(error.response.body, null, 2));
    }
    
    throw new Error(`Failed to send look approval email: ${error.message}`);
  }
}

/**
 * Send look request notification email to stylist
 */
export async function sendLookRequestEmail({
  to,
  stylistName,
  clientName,
  itemCount,
  requestLink,
  itemImages,
}: {
  to: string;
  stylistName: string;
  clientName: string;
  itemCount: number;
  requestLink: string;
  itemImages?: string[];
}): Promise<void> {
  const apiKey = getSendGridKey();
  const fromEmail = getFromEmail();
  try {
    if (!apiKey) throw new Error('SENDGRID_API_KEY environment variable is required');
    sgMail.setApiKey(apiKey);

    const emailBody = `
Hi ${stylistName},

${clientName} has requested a look using ${itemCount} item(s) from their closet.

View the request and create the look:
${requestLink}

Best regards,
Turnstyle
    `.trim();

    const imagesHtml = itemImages && itemImages.length > 0
      ? `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0;">${itemImages.slice(0, 6).map(url => `<img src="${url}" alt="Item" style="width: 80px; height: 80px; object-fit: contain; border-radius: 4px; background: #f5f5f5;" />`).join('')}</div>`
      : '';

    const msg = {
      to,
      from: fromEmail,
      subject: `Look Request from ${clientName} - ${itemCount} item(s)`,
      text: emailBody,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${stylistName},</h2>
          <p style="color: #666; line-height: 1.6;">
            <strong>${clientName}</strong> has requested a look using <strong>${itemCount} item(s)</strong> from their closet.
          </p>
          ${imagesHtml}
          <div style="margin: 30px 0; text-align: center;">
            <a href="${requestLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Request & Create Look</a>
          </div>
          <p style="color: #999; font-size: 14px;">Or copy this link: ${requestLink}</p>
          <p style="color: #666; margin-top: 30px;">Best regards,<br/>Turnstyle</p>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log('✅ Look request email sent to:', to);
  } catch (error: any) {
    console.error('❌ Error sending look request email:', error.message);
    throw new Error(`Failed to send look request email: ${error.message}`);
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    if (!getSendGridKey()) {
      return false;
    }

    // For SendGrid, we can verify by checking if the API key is set
    // In production, you might want to make a test API call
    return true;
  } catch (error) {
    console.error('Email configuration verification failed:', error);
    return false;
  }
}
