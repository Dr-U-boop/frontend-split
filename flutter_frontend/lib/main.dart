import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syncfusion_flutter_charts/charts.dart';

void main() {
  runApp(const GlukozeFlutterApp());
}

class GlukozeFlutterApp extends StatefulWidget {
  const GlukozeFlutterApp({super.key});

  @override
  State<GlukozeFlutterApp> createState() => _GlukozeFlutterAppState();
}

class _GlukozeFlutterAppState extends State<GlukozeFlutterApp> {
  static const _tokenKey = 'accessToken';
  static const _rememberKey = 'rememberMe';

  final ApiClient _api = ApiClient();
  bool _bootstrapping = true;
  String? _token;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final remember = prefs.getBool(_rememberKey) ?? false;
    final token = prefs.getString(_tokenKey);

    if (remember && token != null) {
      _api.setToken(token);
      try {
        await _api.getMe();
        setState(() {
          _token = token;
          _bootstrapping = false;
        });
        return;
      } catch (_) {
        await prefs.remove(_tokenKey);
      }
    }

    setState(() {
      _token = null;
      _bootstrapping = false;
    });
  }

  Future<void> _onLoggedIn(String token, bool rememberMe) async {
    _api.setToken(token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_rememberKey, rememberMe);
    if (rememberMe) {
      await prefs.setString(_tokenKey, token);
    } else {
      await prefs.remove(_tokenKey);
    }
    setState(() {
      _token = token;
    });
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_rememberKey);
    _api.setToken(null);
    setState(() {
      _token = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(seedColor: const Color(0xFF0E7A6A));

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Glukoze',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: colorScheme,
      ),
      home: _bootstrapping
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : (_token == null
                ? LoginPage(api: _api, onLoggedIn: _onLoggedIn)
                : DashboardPage(api: _api, onLogout: _logout)),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.api,
    required this.onLoggedIn,
  });

  final ApiClient api;
  final Future<void> Function(String token, bool rememberMe) onLoggedIn;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _rememberMe = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final token = await widget.api.login(_usernameCtrl.text.trim(), _passwordCtrl.text);
      await widget.onLoggedIn(token, _rememberMe);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
      });
    } catch (_) {
      setState(() {
        _error = 'Не удалось подключиться к серверу';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 430),
          child: Card(
            margin: const EdgeInsets.all(20),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Вход', style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _usernameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Имя пользователя',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Введите имя пользователя' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Пароль',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || v.isEmpty) ? 'Введите пароль' : null,
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _rememberMe,
                      onChanged: (v) => setState(() => _rememberMe = v ?? false),
                      title: const Text('Запомнить меня'),
                    ),
                    if (_error != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          _error!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                        ),
                      ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Войти'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({
    super.key,
    required this.api,
    required this.onLogout,
  });

  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> with TickerProviderStateMixin {
  final _searchCtrl = TextEditingController();
  final _recommendCtrl = TextEditingController();
  final _simParamsCtrl = TextEditingController();
  final _simScenarioCtrl = TextEditingController();
  final _simSeedCtrl = TextEditingController(text: '10');

  late final TabController _tabController;

  List<Patient> _patients = [];
  List<Patient> _filteredPatients = [];
  Patient? _selectedPatient;

  ComprehensiveData? _comprehensive;
  List<String> _recommendations = [];
  List<DiaryEntry> _diary = [];

  bool _loadingPatients = true;
  bool _loadingPatientData = false;
  bool _chartView = true;

  DateTime? _start;
  DateTime? _end;

  Map<String, dynamic>? _parsedRecommendation;

  List<SimulatorScenario> _scenarios = [];
  String? _selectedScenarioId;
  String _simModelType = 'sibr';
  SimulationResult? _simulationResult;

  String _doctorName = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _searchCtrl.addListener(_filterPatients);
    _loadInitial();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _recommendCtrl.dispose();
    _simParamsCtrl.dispose();
    _simScenarioCtrl.dispose();
    _simSeedCtrl.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    setState(() => _loadingPatients = true);
    try {
      final me = await widget.api.getMe();
      final patients = await widget.api.getPatients();
      setState(() {
        _doctorName = (me['full_name'] ?? '').toString();
        _patients = patients;
        _filteredPatients = patients;
      });
      if (patients.isNotEmpty) {
        await _selectPatient(patients.first);
      }
    } on ApiException catch (e) {
      _showSnack(e.message);
    } catch (_) {
      _showSnack('Не удалось загрузить данные');
    } finally {
      if (mounted) {
        setState(() => _loadingPatients = false);
      }
    }
  }

  void _filterPatients() {
    final query = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredPatients = _patients;
      } else {
        _filteredPatients = _patients
            .where(
              (p) => p.fullName.toLowerCase().contains(query) || p.dateOfBirth.contains(query),
            )
            .toList();
      }
    });
  }

  Future<void> _selectPatient(Patient patient) async {
    setState(() {
      _selectedPatient = patient;
      _loadingPatientData = true;
      _start = null;
      _end = null;
      _simulationResult = null;
      _parsedRecommendation = null;
    });

    try {
      final results = await Future.wait<dynamic>([
        widget.api.getComprehensiveData(patient.id),
        widget.api.getRecommendations(patient.id),
        widget.api.getDiary(patient.id),
        widget.api.getSimulatorConfig(patient.id),
      ]);

      final simConfig = results[3] as SimulatorConfig;
      final firstScenario = simConfig.scenarios.isNotEmpty ? simConfig.scenarios.first : null;

      setState(() {
        _comprehensive = results[0] as ComprehensiveData;
        _recommendations = results[1] as List<String>;
        _diary = results[2] as List<DiaryEntry>;

        _simParamsCtrl.text = prettyJson(simConfig.parameters);
        _scenarios = simConfig.scenarios;
        _selectedScenarioId = firstScenario?.scenarioId.toString();
        _simScenarioCtrl.text = prettyJson(firstScenario?.scenarioData ?? defaultScenarioJson());
      });
    } on ApiException catch (e) {
      _showSnack(e.message);
    } catch (_) {
      _showSnack('Не удалось загрузить данные пациента');
    } finally {
      if (mounted) {
        setState(() => _loadingPatientData = false);
      }
    }
  }

  Future<void> _updateChart() async {
    final patientId = _selectedPatient?.id;
    if (patientId == null) return;

    setState(() => _loadingPatientData = true);
    try {
      final data = await widget.api.getComprehensiveData(patientId, start: _start, end: _end);
      setState(() {
        _comprehensive = data;
      });
    } on ApiException catch (e) {
      _showSnack(e.message);
    } finally {
      if (mounted) {
        setState(() => _loadingPatientData = false);
      }
    }
  }

  Future<void> _pickDateTime({required bool isStart}) async {
    final now = DateTime.now();
    final initial = isStart ? (_start ?? now.subtract(const Duration(days: 1))) : (_end ?? now);

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );

    final dateTime = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime?.hour ?? 0,
      pickedTime?.minute ?? 0,
    );

    setState(() {
      if (isStart) {
        _start = dateTime;
      } else {
        _end = dateTime;
      }
    });
  }

  Future<void> _applyQuickRange(Duration duration) async {
    final now = DateTime.now();
    setState(() {
      _end = now;
      _start = now.subtract(duration);
    });
    await _updateChart();
  }

  Future<void> _refreshDiary() async {
    final patientId = _selectedPatient?.id;
    if (patientId == null) return;

    try {
      final entries = await widget.api.getDiary(patientId);
      setState(() {
        _diary = entries;
      });
    } on ApiException catch (e) {
      _showSnack(e.message);
    }
  }

  Future<void> _interpretRecommendation() async {
    final text = _recommendCtrl.text.trim();
    if (text.isEmpty) return;

    try {
      final parsed = await widget.api.interpretRecommendation(text);
      setState(() {
        _parsedRecommendation = parsed;
      });
    } on ApiException catch (e) {
      _showSnack(e.message);
    }
  }

  Future<void> _saveSimParams() async {
    final patientId = _selectedPatient?.id;
    if (patientId == null) return;

    try {
      final jsonMap = jsonDecode(_simParamsCtrl.text) as Map<String, dynamic>;
      await widget.api.saveSimulatorParameters(patientId, jsonMap);
      _showSnack('Параметры симуляции сохранены');
    } catch (_) {
      _showSnack('Некорректный JSON параметров');
    }
  }

  Future<void> _saveScenario() async {
    final patientId = _selectedPatient?.id;
    if (patientId == null) return;

    try {
      final scenarioMap = jsonDecode(_simScenarioCtrl.text) as Map<String, dynamic>;
      final selectedId = int.tryParse(_selectedScenarioId ?? '');
      await widget.api.saveScenario(patientId, scenarioMap, scenarioId: selectedId);
      final config = await widget.api.getSimulatorConfig(patientId);
      final firstScenario = config.scenarios.isNotEmpty ? config.scenarios.first : null;

      setState(() {
        _scenarios = config.scenarios;
        _selectedScenarioId = firstScenario?.scenarioId.toString();
        _simScenarioCtrl.text = prettyJson(firstScenario?.scenarioData ?? scenarioMap);
      });

      _showSnack('Сценарий симуляции сохранен');
    } catch (_) {
      _showSnack('Некорректный JSON сценария');
    }
  }

  Future<void> _runSimulation() async {
    final patientId = _selectedPatient?.id;
    if (patientId == null) return;

    try {
      final parameters = jsonDecode(_simParamsCtrl.text) as Map<String, dynamic>;
      final scenario = jsonDecode(_simScenarioCtrl.text) as Map<String, dynamic>;
      final seed = int.tryParse(_simSeedCtrl.text.trim());

      final result = await widget.api.runSimulation(
        patientId: patientId,
        parameters: parameters,
        scenarioData: scenario,
        modelType: _simModelType,
        cgmNoiseSeed: seed,
      );

      setState(() {
        _simulationResult = result;
      });
    } on ApiException catch (e) {
      _showSnack(e.message);
    } catch (_) {
      _showSnack('Не удалось запустить симуляцию');
    }
  }

  void _showSnack(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_doctorName.isEmpty ? 'Панель управления' : 'Панель управления - $_doctorName'),
        actions: [
          TextButton(
            onPressed: widget.onLogout,
            child: const Text('Выход'),
          ),
        ],
      ),
      body: Row(
        children: [
          SizedBox(
            width: 300,
            child: Card(
              margin: const EdgeInsets.fromLTRB(12, 12, 6, 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    TextField(
                      controller: _searchCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Поиск пациента',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: _loadingPatients
                          ? const Center(child: CircularProgressIndicator())
                          : ListView.builder(
                              itemCount: _filteredPatients.length,
                              itemBuilder: (context, index) {
                                final p = _filteredPatients[index];
                                final selected = _selectedPatient?.id == p.id;
                                return ListTile(
                                  selected: selected,
                                  title: Text(p.fullName),
                                  subtitle: Text(p.dateOfBirth),
                                  onTap: () => _selectPatient(p),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: Card(
              margin: const EdgeInsets.fromLTRB(6, 12, 12, 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: _selectedPatient == null
                    ? const Center(child: Text('Выберите пациента из списка'))
                    : Column(
                        children: [
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              _selectedPatient!.fullName,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TabBar(
                            controller: _tabController,
                            isScrollable: true,
                            tabs: const [
                              Tab(text: 'Мониторинг'),
                              Tab(text: 'Карточка пациента'),
                              Tab(text: 'Дневник пациента'),
                              Tab(text: 'Симулятор'),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Expanded(
                            child: _loadingPatientData
                                ? const Center(child: CircularProgressIndicator())
                                : TabBarView(
                                    controller: _tabController,
                                    children: [
                                      _buildMonitoringTab(),
                                      _buildPatientCardTab(),
                                      _buildDiaryTab(),
                                      _buildSimulatorTab(),
                                    ],
                                  ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonitoringTab() {
    final data = _comprehensive;
    final stats = data == null ? null : PeriodStats.fromComprehensive(data);

    return ListView(
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            OutlinedButton(
              onPressed: () => _pickDateTime(isStart: true),
              child: Text(_start == null ? 'Дата начала' : DateFormat('dd.MM.yyyy HH:mm').format(_start!)),
            ),
            OutlinedButton(
              onPressed: () => _pickDateTime(isStart: false),
              child: Text(_end == null ? 'Дата окончания' : DateFormat('dd.MM.yyyy HH:mm').format(_end!)),
            ),
            FilledButton(onPressed: _updateChart, child: const Text('Показать')),
            TextButton(
              onPressed: () {
                setState(() {
                  _start = null;
                  _end = null;
                });
                _updateChart();
              },
              child: const Text('Сбросить'),
            ),
            SegmentedButton<bool>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment<bool>(value: true, label: Text('График')),
                ButtonSegment<bool>(value: false, label: Text('Таблица')),
              ],
              selected: {_chartView},
              onSelectionChanged: (selection) {
                setState(() {
                  _chartView = selection.first;
                });
              },
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            ActionChip(label: const Text('Последний день'), onPressed: () => _applyQuickRange(const Duration(days: 1))),
            ActionChip(label: const Text('Последний месяц'), onPressed: () => _applyQuickRange(const Duration(days: 30))),
            ActionChip(label: const Text('Последние 3 месяца'), onPressed: () => _applyQuickRange(const Duration(days: 90))),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(height: 380, child: _chartView ? _buildMainChart(data) : _buildDataTable(data)),
        const SizedBox(height: 12),
        _buildStatsCard(stats),
        const SizedBox(height: 12),
        _buildRecommendationCard(),
      ],
    );
  }

  Widget _buildMainChart(ComprehensiveData? data) {
    if (data == null || (data.glucose.isEmpty && data.carbs.isEmpty && data.insulin.isEmpty)) {
      return const Card(child: Center(child: Text('Нет данных за выбранный период')));
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: SfCartesianChart(
          legend: const Legend(isVisible: true),
          primaryXAxis: DateTimeAxis(dateFormat: DateFormat('dd.MM HH:mm')),
          axes: <ChartAxis>[
            NumericAxis(name: 'eventsAxis', opposedPosition: true, title: AxisTitle(text: 'Углеводы / Инсулин')),
          ],
          series: <CartesianSeries<dynamic, DateTime>>[
            LineSeries<ChartPoint, DateTime>(
              name: 'Глюкоза (ммоль/л)',
              dataSource: data.glucose,
              xValueMapper: (p, _) => p.x,
              yValueMapper: (p, _) => p.y,
            ),
            ColumnSeries<ChartPoint, DateTime>(
              name: 'Углеводы (г)',
              yAxisName: 'eventsAxis',
              dataSource: data.carbs,
              xValueMapper: (p, _) => p.x,
              yValueMapper: (p, _) => p.y,
            ),
            LineSeries<ChartPoint, DateTime>(
              name: 'Инсулин (ЕД)',
              yAxisName: 'eventsAxis',
              dataSource: data.insulin,
              xValueMapper: (p, _) => p.x,
              yValueMapper: (p, _) => p.y,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDataTable(ComprehensiveData? data) {
    final merged = mergeRows(data);
    if (merged.isEmpty) {
      return const Card(child: Center(child: Text('Нет данных за выбранный период')));
    }

    return Card(
      child: SingleChildScrollView(
        child: DataTable(
          columns: const [
            DataColumn(label: Text('Время')),
            DataColumn(label: Text('Глюкоза')),
            DataColumn(label: Text('Углеводы')),
            DataColumn(label: Text('Инсулин')),
          ],
          rows: merged
              .map(
                (r) => DataRow(
                  cells: [
                    DataCell(Text(DateFormat('dd.MM.yyyy HH:mm').format(r.timestamp))),
                    DataCell(Text(r.glucose?.toStringAsFixed(2) ?? '-')),
                    DataCell(Text(r.carbs?.toStringAsFixed(2) ?? '-')),
                    DataCell(Text(r.insulin?.toStringAsFixed(2) ?? '-')),
                  ],
                ),
              )
              .toList(),
        ),
      ),
    );
  }

  Widget _buildStatsCard(PeriodStats? stats) {
    final periodText = (_start != null && _end != null)
        ? 'Период: ${DateFormat('dd.MM.yyyy HH:mm').format(_start!)} - ${DateFormat('dd.MM.yyyy HH:mm').format(_end!)}'
        : 'Период: последние 7 дней (по умолчанию)';

    Widget statItem(String label, String value) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Статистика периода', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(periodText),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              childAspectRatio: 2.9,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                statItem('Измерений', stats?.count.toString() ?? '-'),
                statItem('Средняя глюкоза', stats == null ? '-' : '${stats.avg.toStringAsFixed(1)} ммоль/л'),
                statItem('Минимум', stats == null ? '-' : '${stats.min.toStringAsFixed(1)} ммоль/л'),
                statItem('Максимум', stats == null ? '-' : '${stats.max.toStringAsFixed(1)} ммоль/л'),
                statItem('Станд. отклонение', stats == null ? '-' : stats.std.toStringAsFixed(2)),
                statItem('В диапазоне 3.9-10.0', stats == null ? '-' : '${stats.tir.toStringAsFixed(1)}%'),
                statItem('Гипо (<3.9)', stats?.hypo.toString() ?? '-'),
                statItem('Гипер (>10.0)', stats?.hyper.toString() ?? '-'),
                statItem('Сумма углеводов, г', stats == null ? '-' : stats.carbsSum.toStringAsFixed(1)),
                statItem('Сумма инсулина, ЕД', stats == null ? '-' : stats.insulinSum.toStringAsFixed(1)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecommendationCard() {
    final parsed = _parsedRecommendation;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Рекомендации', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (_recommendations.isEmpty)
              const Text('Рекомендации не найдены')
            else
              ..._recommendations.map((r) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('- $r'),
                  )),
            const SizedBox(height: 12),
            TextField(
              controller: _recommendCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Редактор рекомендаций',
                hintText: 'Пример: Снизить базальный инсулин ночью...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(onPressed: _interpretRecommendation, child: const Text('Интерпретировать')),
            if (parsed != null) ...[
              const SizedBox(height: 10),
              Text('Распарсенный результат:', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  border: Border.all(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(prettyJson(parsed)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPatientCardTab() {
    final p = _selectedPatient;
    if (p == null) {
      return const Center(child: Text('Пациент не выбран'));
    }

    return ListView(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Основные данные', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('ФИО: ${p.fullName}'),
                Text('Дата рождения: ${p.dateOfBirth}'),
                Text('Контакт: ${p.contactInfo ?? '-'}'),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDiaryTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Дневник самоконтроля', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: _refreshDiary, child: const Text('Обновить')),
          ],
        ),
        const SizedBox(height: 8),
        Expanded(
          child: Card(
            child: _diary.isEmpty
                ? const Center(child: Text('Нет записей дневника самоконтроля'))
                : ListView.separated(
                    itemCount: _diary.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final d = _diary[index];
                      return ListTile(
                        title: Text(DateFormat('dd.MM.yyyy HH:mm').format(d.timestamp)),
                        subtitle: Text(d.text),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildSimulatorTab() {
    final sim = _simulationResult;
    return ListView(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Параметры пациента', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                TextField(
                  controller: _simParamsCtrl,
                  maxLines: 12,
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                ),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: _saveSimParams, child: const Text('Сохранить параметры')),
                const SizedBox(height: 16),
                Text('Сценарий симулятора', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    DropdownButton<String>(
                      value: _selectedScenarioId,
                      hint: const Text('Выберите сценарий'),
                      items: _scenarios
                          .map(
                            (s) => DropdownMenuItem(
                              value: s.scenarioId.toString(),
                              child: Text('Сценарий #${s.scenarioId}'),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        final scenario = _scenarios.firstWhereOrNull((s) => s.scenarioId.toString() == value);
                        setState(() {
                          _selectedScenarioId = value;
                          if (scenario != null) {
                            _simScenarioCtrl.text = prettyJson(scenario.scenarioData);
                          }
                        });
                      },
                    ),
                    OutlinedButton(
                      onPressed: () {
                        setState(() {
                          _selectedScenarioId = null;
                          _simScenarioCtrl.text = prettyJson(defaultScenarioJson());
                        });
                      },
                      child: const Text('Новый сценарий'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _simScenarioCtrl,
                  maxLines: 12,
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(onPressed: _saveScenario, child: const Text('Сохранить сценарий')),
                    DropdownButton<String>(
                      value: _simModelType,
                      items: const [
                        DropdownMenuItem(value: 'sibr', child: Text('SIBR')),
                        DropdownMenuItem(value: 'dm', child: Text('DM')),
                      ],
                      onChanged: (v) => setState(() => _simModelType = v ?? 'sibr'),
                    ),
                    SizedBox(
                      width: 130,
                      child: TextField(
                        controller: _simSeedCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'CGM seed',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    FilledButton(onPressed: _runSimulation, child: const Text('Запустить симуляцию')),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Результаты симуляции', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (sim == null)
                  const Text('Симуляция не запускалась')
                else ...[
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _metricTile('Средняя глюкоза', sim.avgText),
                      _metricTile('Минимум', sim.minText),
                      _metricTile('Максимум', sim.maxText),
                      _metricTile('В диапазоне 3.9-10.0', sim.tirText),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 340,
                    child: SfCartesianChart(
                      primaryXAxis: NumericAxis(title: AxisTitle(text: 'Время, мин')),
                      series: <CartesianSeries<dynamic, double>>[
                        LineSeries<SimPoint, double>(
                          dataSource: sim.points,
                          xValueMapper: (p, _) => p.time,
                          yValueMapper: (p, _) => p.glucose,
                          name: 'Глюкоза (ммоль/л)',
                        )
                      ],
                    ),
                  ),
                ]
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _metricTile(String label, String value) {
    return SizedBox(
      width: 220,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}

class ApiClient {
  ApiClient({
    http.Client? client,
  }) : _client = client ?? http.Client();

  final http.Client _client;
  final String baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://127.0.0.1:8000');

  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Future<String> login(String username, String password) async {
    final response = await _request(
      method: 'POST',
      path: '/api/auth/login',
      body: {
        'username': username,
        'password': password,
      },
      authorized: false,
    );

    return response['access_token'] as String;
  }

  Future<Map<String, dynamic>> getMe() async {
    return _request(method: 'GET', path: '/api/auth/me');
  }

  Future<List<Patient>> getPatients() async {
    final response = await _request(method: 'GET', path: '/api/patients/');
    return (response as List<dynamic>).map((e) => Patient.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ComprehensiveData> getComprehensiveData(int patientId, {DateTime? start, DateTime? end}) async {
    final query = <String, String>{};
    if (start != null && end != null) {
      query['start_datetime'] = start.toIso8601String();
      query['end_datetime'] = end.toIso8601String();
    }

    final response = await _request(
      method: 'GET',
      path: '/api/patients/$patientId/comprehensive_data',
      query: query,
    );

    return ComprehensiveData.fromJson(response);
  }

  Future<List<String>> getRecommendations(int patientId) async {
    final response = await _request(method: 'GET', path: '/api/patients/$patientId/recommendations');
    return (response['recommendations'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
  }

  Future<Map<String, dynamic>> interpretRecommendation(String text) async {
    return _request(
      method: 'POST',
      path: '/api/recommendations/interpret',
      body: {'text': text},
    );
  }

  Future<List<DiaryEntry>> getDiary(int patientId) async {
    final response = await _request(method: 'GET', path: '/api/patients/$patientId/diary');
    return (response as List<dynamic>).map((e) => DiaryEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<SimulatorConfig> getSimulatorConfig(int patientId) async {
    final response = await _request(method: 'GET', path: '/api/simulator/patients/$patientId/config');
    return SimulatorConfig.fromJson(response);
  }

  Future<void> saveSimulatorParameters(int patientId, Map<String, dynamic> parameters) async {
    await _request(
      method: 'PUT',
      path: '/api/simulator/patients/$patientId/parameters',
      body: {'parameters': parameters},
    );
  }

  Future<void> saveScenario(int patientId, Map<String, dynamic> scenarioData, {int? scenarioId}) async {
    if (scenarioId == null) {
      await _request(
        method: 'POST',
        path: '/api/simulator/patients/$patientId/scenarios',
        body: {'scenario_data': scenarioData},
      );
    } else {
      await _request(
        method: 'PUT',
        path: '/api/simulator/patients/$patientId/scenarios/$scenarioId',
        body: {'scenario_data': scenarioData},
      );
    }
  }

  Future<SimulationResult> runSimulation({
    required int patientId,
    required Map<String, dynamic> parameters,
    required Map<String, dynamic> scenarioData,
    required String modelType,
    int? cgmNoiseSeed,
  }) async {
    final response = await _request(
      method: 'POST',
      path: '/api/simulator/patients/$patientId/run',
      body: {
        'parameters': parameters,
        'scenario_data': scenarioData,
        'model_type': modelType,
        'cgm_noise_seed': cgmNoiseSeed,
      },
    );

    return SimulationResult.fromJson(response);
  }

  Future<dynamic> _request({
    required String method,
    required String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool authorized = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query == null || query.isEmpty ? null : query);

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (authorized && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }

    late http.Response response;
    if (method == 'GET') {
      response = await _client.get(uri, headers: headers);
    } else if (method == 'POST') {
      response = await _client.post(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else if (method == 'PUT') {
      response = await _client.put(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else {
      throw ApiException('Неподдерживаемый метод: $method');
    }

    dynamic decoded;
    if (response.body.isNotEmpty) {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    }

    if (response.statusCode >= 400) {
      final message = (decoded is Map<String, dynamic> && decoded['detail'] != null)
          ? decoded['detail'].toString()
          : 'Ошибка API: ${response.statusCode}';
      throw ApiException(message);
    }

    return decoded;
  }
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class Patient {
  Patient({
    required this.id,
    required this.fullName,
    required this.dateOfBirth,
    required this.contactInfo,
  });

  final int id;
  final String fullName;
  final String dateOfBirth;
  final String? contactInfo;

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: (json['id'] as num).toInt(),
      fullName: (json['full_name'] ?? '').toString(),
      dateOfBirth: (json['date_of_birth'] ?? '').toString(),
      contactInfo: json['contact_info']?.toString(),
    );
  }
}

class ChartPoint {
  ChartPoint({required this.x, required this.y});

  final DateTime x;
  final double y;

  factory ChartPoint.fromJson(Map<String, dynamic> json) {
    return ChartPoint(
      x: DateTime.parse(json['x'].toString()),
      y: toDouble(json['y']),
    );
  }
}

class ComprehensiveData {
  ComprehensiveData({
    required this.glucose,
    required this.insulin,
    required this.carbs,
  });

  final List<ChartPoint> glucose;
  final List<ChartPoint> insulin;
  final List<ChartPoint> carbs;

  factory ComprehensiveData.fromJson(Map<String, dynamic> json) {
    return ComprehensiveData(
      glucose: parsePoints(json['glucose']),
      insulin: parsePoints(json['insulin']),
      carbs: parsePoints(json['carbs']),
    );
  }
}

class DiaryEntry {
  DiaryEntry({required this.timestamp, required this.text});

  final DateTime timestamp;
  final String text;

  factory DiaryEntry.fromJson(Map<String, dynamic> json) {
    return DiaryEntry(
      timestamp: DateTime.parse(json['timestamp'].toString()),
      text: (json['text'] ?? '').toString(),
    );
  }
}

class SimulatorScenario {
  SimulatorScenario({required this.scenarioId, required this.scenarioData});

  final int scenarioId;
  final Map<String, dynamic> scenarioData;

  factory SimulatorScenario.fromJson(Map<String, dynamic> json) {
    return SimulatorScenario(
      scenarioId: (json['scenario_id'] as num).toInt(),
      scenarioData: (json['scenario_data'] as Map<String, dynamic>? ?? {}),
    );
  }
}

class SimulatorConfig {
  SimulatorConfig({required this.parameters, required this.scenarios});

  final Map<String, dynamic> parameters;
  final List<SimulatorScenario> scenarios;

  factory SimulatorConfig.fromJson(Map<String, dynamic> json) {
    final scenariosRaw = json['scenarios'] as List<dynamic>? ?? [];
    return SimulatorConfig(
      parameters: (json['parameters'] as Map<String, dynamic>? ?? {}),
      scenarios: scenariosRaw.map((e) => SimulatorScenario.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class SimPoint {
  SimPoint({required this.time, required this.glucose});

  final double time;
  final double glucose;
}

class SimulationResult {
  SimulationResult({
    required this.points,
    required this.avgText,
    required this.minText,
    required this.maxText,
    required this.tirText,
  });

  final List<SimPoint> points;
  final String avgText;
  final String minText;
  final String maxText;
  final String tirText;

  factory SimulationResult.fromJson(Map<String, dynamic> json) {
    final time = ((json['time'] as List<dynamic>? ?? []).map(toDouble).toList());

    List<double> glucose = [];
    final glucoseMmolRaw = json['glucose_mmol'] as List<dynamic>?;
    if (glucoseMmolRaw != null && glucoseMmolRaw.isNotEmpty) {
      glucose = glucoseMmolRaw.map(toDouble).toList();
    } else {
      final glucoseRaw = (json['glucose'] as List<dynamic>? ?? []).map(toDouble).toList();
      final hasMgDl = glucoseRaw.any((v) => v > 40);
      glucose = hasMgDl ? glucoseRaw.map((v) => v / 18.0).toList() : glucoseRaw;
    }

    final len = time.length < glucose.length ? time.length : glucose.length;
    final points = List.generate(len, (i) => SimPoint(time: time[i], glucose: glucose[i]));

    final metrics = (json['metrics'] as Map<String, dynamic>? ?? {});
    final avg = normalizeMaybeMgDl(metrics['average']);
    final min = normalizeMaybeMgDl(metrics['min']);
    final max = normalizeMaybeMgDl(metrics['max']);

    final tirFromSeries = computeTir(glucose);
    final tirMetric = toDoubleOrNull(metrics['fraction_within_target']);
    final tir = tirFromSeries ?? tirMetric;

    return SimulationResult(
      points: points,
      avgText: avg == null ? '-' : '${avg.toStringAsFixed(2)} ммоль/л',
      minText: min == null ? '-' : '${min.toStringAsFixed(2)} ммоль/л',
      maxText: max == null ? '-' : '${max.toStringAsFixed(2)} ммоль/л',
      tirText: tir == null ? '-' : '${(tir * 100).toStringAsFixed(1)}%',
    );
  }
}

class PeriodStats {
  PeriodStats({
    required this.count,
    required this.avg,
    required this.min,
    required this.max,
    required this.std,
    required this.tir,
    required this.hypo,
    required this.hyper,
    required this.carbsSum,
    required this.insulinSum,
  });

  final int count;
  final double avg;
  final double min;
  final double max;
  final double std;
  final double tir;
  final int hypo;
  final int hyper;
  final double carbsSum;
  final double insulinSum;

  factory PeriodStats.fromComprehensive(ComprehensiveData data) {
    final glucose = data.glucose.map((e) => e.y).toList();
    final carbs = data.carbs.map((e) => e.y).toList();
    final insulin = data.insulin.map((e) => e.y).toList();

    if (glucose.isEmpty) {
      return PeriodStats(
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        std: 0,
        tir: 0,
        hypo: 0,
        hyper: 0,
        carbsSum: carbs.fold(0, (a, b) => a + b),
        insulinSum: insulin.fold(0, (a, b) => a + b),
      );
    }

    final count = glucose.length;
    final avg = glucose.reduce((a, b) => a + b) / count;
    final min = glucose.reduce((a, b) => a < b ? a : b);
    final max = glucose.reduce((a, b) => a > b ? a : b);

    final variance = glucose.fold<double>(0, (acc, v) => acc + (v - avg) * (v - avg)) / count;
    final std = variance <= 0 ? 0 : variance.sqrt();

    final inRange = glucose.where((v) => v >= 3.9 && v <= 10.0).length;
    final hypo = glucose.where((v) => v < 3.9).length;
    final hyper = glucose.where((v) => v > 10.0).length;

    return PeriodStats(
      count: count,
      avg: avg,
      min: min,
      max: max,
      std: std,
      tir: (inRange / count) * 100,
      hypo: hypo,
      hyper: hyper,
      carbsSum: carbs.fold(0, (a, b) => a + b),
      insulinSum: insulin.fold(0, (a, b) => a + b),
    );
  }
}

class TableRowData {
  TableRowData({
    required this.timestamp,
    this.glucose,
    this.carbs,
    this.insulin,
  });

  final DateTime timestamp;
  final double? glucose;
  final double? carbs;
  final double? insulin;
}

List<TableRowData> mergeRows(ComprehensiveData? data) {
  if (data == null) return [];

  final map = <String, TableRowData>{};

  void put(List<ChartPoint> points, void Function(TableRowData row, double value) setter) {
    for (final p in points) {
      final key = p.x.toIso8601String();
      final existing = map[key] ?? TableRowData(timestamp: p.x);
      setter(existing, p.y);
      map[key] = existing;
    }
  }

  put(data.glucose, (row, value) => map[row.timestamp.toIso8601String()] = TableRowData(
        timestamp: row.timestamp,
        glucose: value,
        carbs: row.carbs,
        insulin: row.insulin,
      ));

  put(data.carbs, (row, value) => map[row.timestamp.toIso8601String()] = TableRowData(
        timestamp: row.timestamp,
        glucose: row.glucose,
        carbs: value,
        insulin: row.insulin,
      ));

  put(data.insulin, (row, value) => map[row.timestamp.toIso8601String()] = TableRowData(
        timestamp: row.timestamp,
        glucose: row.glucose,
        carbs: row.carbs,
        insulin: value,
      ));

  final rows = map.values.toList();
  rows.sort((a, b) => a.timestamp.compareTo(b.timestamp));
  return rows;
}

List<ChartPoint> parsePoints(dynamic raw) {
  if (raw is! List) return [];
  return raw
      .whereType<Map>()
      .map((item) => item.map((key, value) => MapEntry(key.toString(), value)))
      .map(ChartPoint.fromJson)
      .toList();
}

String prettyJson(Object? value) {
  const encoder = JsonEncoder.withIndent('  ');
  return encoder.convert(value);
}

Map<String, dynamic> defaultScenarioJson() {
  return {
    'M': 90,
    'tm': 60,
    'Tm': 20,
    't0': 0,
    't1': 720,
    'ti_1': 30,
    'ti_2': 60,
    'Ti_1': 10,
    'Ti_2': 10,
    'Dbol_1': 2.6,
    'Dbol_2': 4.0,
    'Vbas': 1.22,
  };
}

double toDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

double? toDoubleOrNull(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

double? normalizeMaybeMgDl(dynamic value) {
  final parsed = toDoubleOrNull(value);
  if (parsed == null) return null;
  return parsed > 40 ? parsed / 18.0 : parsed;
}

double? computeTir(List<double> glucoseMmol) {
  if (glucoseMmol.isEmpty) return null;
  final inRange = glucoseMmol.where((g) => g >= 3.9 && g <= 10.0).length;
  return inRange / glucoseMmol.length;
}

extension DoubleSqrt on double {
  double sqrt() {
    if (this <= 0) return 0;
    double x = this;
    double root = x / 2;
    for (var i = 0; i < 12; i++) {
      root = 0.5 * (root + x / root);
    }
    return root;
  }
}

extension FirstWhereOrNullExtension<T> on Iterable<T> {
  T? firstWhereOrNull(bool Function(T element) test) {
    for (final element in this) {
      if (test(element)) return element;
    }
    return null;
  }
}
