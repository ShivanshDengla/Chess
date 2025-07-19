import { NextRequest, NextResponse } from 'next/server';
import { MiniAppPaymentSuccessPayload } from '@worldcoin/minikit-js';

interface IRequestPayload {
  to: string;
  payload: MiniAppPaymentSuccessPayload;
}

export async function POST(req: NextRequest) {
  const requestBody = await req.json();
  console.log(
    '--- Received request in /api/confirm-payment ---',
    JSON.stringify(requestBody, null, 2)
  );
  const { to, payload } = requestBody as IRequestPayload;

  // IMPORTANT: Here we should fetch the reference you created in /initiate-payment to ensure the transaction we are verifying is the same one we initiated
  // In a real app, you would look up the reference from your database
  // const reference = getReferenceFromDB(payload.reference)

  const response = await fetch(
    `https://developer.worldcoin.org/api/v2/minikit/transaction/${payload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_APP_ID}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}`,
      },
    }
  );

  const transaction = await response.json();

  console.log('Full transaction response from Worldcoin API:', JSON.stringify(transaction, null, 2));

  // Defensive check for a valid transaction object
  if (!transaction || typeof transaction.transactionStatus === 'undefined') {
    console.error(
      'Invalid transaction response from Worldcoin API. This might be due to an incorrect APP_ID or DEV_PORTAL_API_KEY. Please check your environment variables.',
      transaction
    );
    return NextResponse.json({ success: false, status: 'failed' });
  }

  const isToAddressMatch =
    transaction.recipientAddress &&
    to &&
    transaction.recipientAddress.toLowerCase() === to.toLowerCase();

  console.log('--- Payment Confirmation ---');
  console.log(`Received Transaction ID: ${payload.transaction_id}`);
  console.log(`Transaction Status from API: ${transaction.transactionStatus}`);
  console.log(`Reference Match: ${transaction.reference === payload.reference}`);
  console.log(`Recipient Match (case-insensitive): ${isToAddressMatch}`);
  console.log('--------------------------');

  if (transaction.reference === payload.reference && isToAddressMatch) {
    if (transaction.transactionStatus === 'mined') {
      return NextResponse.json({ success: true, status: 'mined' });
    } else if (
      transaction.transactionStatus === 'failed' ||
      transaction.transactionStatus === 'cancelled'
    ) {
      return NextResponse.json({ success: false, status: 'failed' });
    } else {
      return NextResponse.json({ success: false, status: 'pending' });
    }
  } else {
    return NextResponse.json({ success: false, status: 'failed' });
  }
} 