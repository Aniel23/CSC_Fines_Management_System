import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect legacy landing to login
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
}
