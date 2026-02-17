const express = require("express");
const mongoose = require("mongoose");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

// --- إعدادات تليجرام وقاعدة البيانات ---
const apiId = process.env.API_ID || 37461011; // ضع بياناتك
const apiHash = process.env.API_HASH || "4f2c2d7d078d3fd2ecd08051215169d5";
const stringSession = new StringSession(process.env.SESSION || "1BAAOMTQ5LjE1NC4xNjcuOTEAUKZZbZvy4JGerJK9hGnde+NOgnspeZG9b+MwKbaMTigTypVug+hOUJcunKy0iopqcQnOYdLhTdylxQA8FTMYScmkUulzl50bNlaW4k6pZrxa8qe1QBDmjbLVQ12crU2EE3F48oMOEZsKvGYTK2T8zfZzjG/vtfLdPtVap8okGeq/MidczOIMnGR18v74KJnTYvfQqXWAOEezspQuQYK1iIMxR3x0EpJXpryPQAThgCJzMLmZaZRIShSh+C8jzuBpsNwXkrPSuQmosj9wcffhPPtBw61ewfq6DX5OfrzY+xVOg/k4z1ew58dVI7FrXuOR9XCpTklRTYStTUsKjYihRvg="); 
const mongoURI = process.env.MONGO_URI || "mongodb+srv://ahmedmerie1612_db_user:3mzkLbPjLAJmlcuF@cluster0.7qh0kid.mongodb.net/?appName=Cluster0"; // رابط MongoDB

mongoose.connect(mongoURI)
    .then(() => console.log("✅ متصل بقاعدة البيانات السحابية"))
    .catch(err => console.error("❌ فشل الاتصال:", err));

const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

// --- هيكل البيانات المحدث (يدعم الحلقات والجودات) ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', userSchema);

const notificationSchema = new mongoose.Schema({
    title: String, message: String, date: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

const seriesSchema = new mongoose.Schema({
    title: { type: String, required: true },
    desc: String,
    poster: String,
    rating: { type: Number, default: 0 },
    // التحديث الجديد: مصفوفة الحلقات، وكل حلقة لها مصفوفة جودات
    episodes: [{
        title: String,
        sources: [{ quality: String, link: String }] // مثال: quality: "1080p", link: "channel/123"
    }],
    comments: [{ user: String, text: String, date: { type: Date, default: Date.now } }]
});
const Series = mongoose.model('Series', seriesSchema);

// --- مسارات الـ API ---

app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        // التحقق من عدم وجود مستخدم بنفس الاسم
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: "الاسم موجود مسبقاً" });

        const newUser = new User({ username, password, role: 'user' });
        await newUser.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "فشل في عملية الحفظ" });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) res.json({ success: true, role: user.role });
    else res.status(401).json({ error: "خطأ في البيانات" });
});

app.get("/api/users", async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
});

app.post("/api/series", async (req, res) => {
    try {
        const newShow = new Series(req.body);
        await newShow.save();
        const newNotif = new Notification({ title: "🔥 إضافة جديدة!", message: `تمت إضافة: ${req.body.title}` });
        await newNotif.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "فشل الحفظ" }); }
});

app.get("/api/series", async (req, res) => {
    const allSeries = await Series.find();
    res.json(allSeries);
});

app.get("/api/notifications", async (req, res) => {
    const notifs = await Notification.find().sort({ date: -1 }).limit(5);
    res.json(notifs);
});

app.post("/api/series/:id/comment", async (req, res) => {
    const { user, text } = req.body;
    await Series.findByIdAndUpdate(req.params.id, { $push: { comments: { user, text } } });
    res.json({ success: true });
});

// --- معالجة الفيديو من تليجرام ---
app.get("/video/:channelId/:messageId", async (req, res) => {
    const { channelId, messageId } = req.params;
    try {
        if (!client.connected) await client.connect();
        const message = await client.getMessages(channelId, { ids: parseInt(messageId) });
        const media = message[0].media;
        res.setHeader("Content-Type", "video/mp4");
        // دعم التقديم والتأخير الجزئي
        res.setHeader("Accept-Ranges", "bytes"); 
        const stream = client.iterDownload({ file: media, requestSize: 1024 * 1024 });
        for await (const chunk of stream) { res.write(chunk); }
        res.end();
    } catch (e) { res.status(500).send("Error"); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on port ${port}`));