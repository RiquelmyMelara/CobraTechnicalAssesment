import Link from 'next/link';

export default function Home() {
  return (
    <section className="spaced">
      <h1>Pet Adoption Board</h1>
      <p className="muted">
        A small frontend for the Cobra Studio backend assessment. Browse pets
        available for adoption, apply for one, and watch staff approve or
        reject applications.
      </p>
      <div className="row">
        <Link href="/pets"><button>Browse pets</button></Link>
        <Link href="/login"><button className="ghost">Log in</button></Link>
        <Link href="/register"><button className="ghost">Create account</button></Link>
      </div>
      <div className="card">
        <h3>Demo accounts (after running <code>npm run seed</code>)</h3>
        <p className="muted" style={{ margin: 0 }}>
          Staff: <code>staff@cobra.local / Password1!</code>
          <br />
          Adopter: <code>alice@cobra.local / Password1!</code>
        </p>
      </div>
    </section>
  );
}
