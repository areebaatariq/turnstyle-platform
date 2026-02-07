import { apiRequest, ApiResponse } from './api';

interface SendInvitationRequest {
  clientId: string;
  clientEmail: string;
  clientName: string;
  customMessage?: string;
}

interface SendInvitationResponse {
  message: string;
  data?: {
    relationshipId: string;
    inviteLink: string;
  };
}

/**
 * Send invitation email to client
 */
export const sendInvitationEmail = async (
  params: SendInvitationRequest
): Promise<SendInvitationResponse> => {
  console.log('🚨 inviteApi.sendInvitationEmail: FUNCTION CALLED');
  console.log('   Function received params:', params);
  console.log('   Params type check:', {
    clientId: typeof params.clientId,
    clientEmail: typeof params.clientEmail,
    clientName: typeof params.clientName,
    hasCustomMessage: !!params.customMessage,
  });
  
  // Validate params
  if (!params.clientId || !params.clientEmail || !params.clientName) {
    const error = new Error('Missing required parameters: clientId, clientEmail, and clientName are required');
    console.error('❌ inviteApi: Validation error:', error.message);
    throw error;
  }
  
  try {
    console.log('📤 inviteApi: Making POST request to /invites/send');
    console.log('   Full URL will be: http://localhost:3000/api/invites/send');
    console.log('   Request body:', JSON.stringify(params));
    
    const response = await apiRequest<SendInvitationResponse>('/invites/send', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    console.log('✅ inviteApi: Received response:', response);
    console.log('✅ inviteApi: Response type:', typeof response);
    return response;
  } catch (error: any) {
    console.error('❌ inviteApi: Error sending invitation:', error);
    console.error('❌ inviteApi: Error details:', {
      message: error?.message,
      stack: error?.stack,
      error: error,
    });
    
    // Re-throw with more context
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to send invitation: ${error}`);
  }
};
