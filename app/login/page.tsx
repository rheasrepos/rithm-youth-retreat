import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Come in" };

export default function LoginPage() {
  return (
    <>
      <header className="hero">
        <h1>The Changemaker <em>Network</em></h1>
        <p className="lede">This is a working space for the people who were at the retreat and the Rithm network. Type the password the group shared with you.</p>
      </header>
      <LoginForm />
    </>
  );
}
