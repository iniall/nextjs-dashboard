'use server'
import { sql } from '@vercel/postgres'; // 这里需要注意
import { customers } from "./placeholder-data"
import {z} from 'zod'
import { revalidatePath } from 'next/cache';
import {redirect} from 'next/navigation'
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';


const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({invalid_type_error: 'Please select a customer.'}),
  amount: z.coerce.number().gt(0,{message: 'Please enter an amount greater than 0.', }),
  status: z.enum(['pending', 'paid'],{invalid_type_error: 'Please select an invoice status.'}),
  date: z.string(),
});
const CreateInvoice=FormSchema.omit({id:true,date:true})
const UpdateInvoice=FormSchema.omit({id:true,date:true})
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};
export async function createInvoice(preState:State,formdata:FormData){

  const validatedFields=CreateInvoice.safeParse({
    customerId:formdata.get('customerId'),
    amount:formdata.get('amount'),
    status:formdata.get('status')
  })
  console.log(validatedFields)
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  // 金额转为分存储
  const amountInCents=amount*100
  const date=new Date().toISOString().split('T')[0];
  try{
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  }catch(error){
    return {
      message: 'Database Error: Failed to Create Invoice.'
    }
  }

  // 清除缓存
  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')

}

export async function updateInvoice(id:string, preState:State, formdata:FormData){
  const validatedFields=CreateInvoice.safeParse({
    customerId:formdata.get('customerId'),
    amount:formdata.get('amount'),
    status:formdata.get('status')
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  // 金额转为分存储
  const amountInCents=amount*100
  const date=new Date().toISOString().split('T')[0];
  try{
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}, date = ${date}
    WHERE id = ${id}
  `;
  }catch(error){
    return {
      message: 'Database Error: Failed to Update Invoice.'
    }
  }
  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')

}

export async function deleteInvoice(id:string){
  try{
    await sql`
    DELETE FROM invoices WHERE id = ${id}
    `
  }catch(error){
    return {
      message: 'Database Error: Failed to Delete Invoice.'
    }
  }
  revalidatePath('/dashboard/invoices')
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}