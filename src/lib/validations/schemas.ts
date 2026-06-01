import { z } from "zod";

export const seasonSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  start_date: z.string(),
  end_date: z.string(),
});
