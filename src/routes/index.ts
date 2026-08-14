import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import tutorRoutes from "./tutor.routes";
import petRoutes from "./pet.routes";
import planRoutes from "./plan.routes";
import subscriptionRoutes from "./subscription.routes";
import adminRoutes from "./admin.routes";
import webhookRoutes from "./webhook.routes";
import vetRoutes from "./vet.routes";
import consultationRoutes from "./consultation.routes";
import medicoRoutes from "./medico.routes";
import patientRoutes from "./patient.routes";
import schedulingRoutes from "./scheduling.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/tutors", tutorRoutes);
router.use("/pets", petRoutes);
router.use("/plans", planRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/admin", adminRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/vet", vetRoutes);
router.use("/medico", medicoRoutes);
router.use("/consultations", consultationRoutes);
router.use("/patient", patientRoutes);
router.use("/scheduling", schedulingRoutes);

export default router;
