import { getServerAuthSession } from "@/auth";
import Header from "@/components/layout/Header";

async function PlayerBoard() {
  const session = await getServerAuthSession();
  const user = session?.user;
  return (
    <>
      <Header user={user} />
    </>
  );
}

export default PlayerBoard;
