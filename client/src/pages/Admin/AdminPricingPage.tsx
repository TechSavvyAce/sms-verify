import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Space, InputNumber, Form, Modal, Tag, Typography, Select, message, Input, Divider, Tooltip, Popconfirm, Row, Col, Alert, Drawer } from "antd";
import { adminApi } from "../../services/api";
import { countries, serviceCategories } from "../../data/services";
import { useTranslation } from "react-i18next";

const { Title, Text } = Typography;

const AdminPricingPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<{ service_code?: string; country_id?: number; enabled?: boolean }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [setPriceModalOpen, setSetPriceModalOpen] = useState(false);
  const [setPriceValue, setSetPriceValue] = useState<number | null>(null);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<"service" | "country">("service");
  const [groupKey, setGroupKey] = useState<string | number>("");
  const [groupList, setGroupList] = useState<any[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);

  const applyQuickAdjust = async (op: "increase" | "decrease" | "multiply", value: number) => {
    if (selectedRows.length === 0) return;
    setBatchLoading(true);
    try {
      // Process requests sequentially with small delay to avoid overwhelming the server
      for (let i = 0; i < selectedRows.length; i++) {
        const r = selectedRows[i];
        try {
          await adminApi.updatePricing(r.id, { price: Math.round(applyOp(r.price, op, value) * 100) / 100 });
          // Small delay between requests to prevent overwhelming the server
          if (i < selectedRows.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Failed to update pricing for row ${i + 1}:`, error);
          // Continue with other updates even if one fails
        }
      }
      message.success(t("adminPricing.updated"));
      fetchList(pagination.current, pagination.pageSize);
    } catch (e) {
      message.error(t("adminPricing.updateFailed"));
    } finally {
      setBatchLoading(false);
    }
  };

  const applyToggleEnabled = async (enabled: boolean) => {
    if (selectedRows.length === 0) return;
    setBatchLoading(true);
    try {
      // Process requests sequentially with small delay to avoid overwhelming the server
      for (let i = 0; i < selectedRows.length; i++) {
        const r = selectedRows[i];
        try {
          await adminApi.updatePricing(r.id, { enabled });
          // Small delay between requests to prevent overwhelming the server
          if (i < selectedRows.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Failed to update enabled status for row ${i + 1}:`, error);
          // Continue with other updates even if one fails
        }
      }
      message.success(t("adminPricing.updated"));
      fetchList(pagination.current, pagination.pageSize);
    } catch (e) {
      message.error(t("adminPricing.updateFailed"));
    } finally {
      setBatchLoading(false);
    }
  };

  const serviceOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    serviceCategories.forEach((cat: any) => {
      cat.services.forEach((s: any) => {
        options.push({ label: `${s.name || s.name_cn} (${s.code})`, value: s.code });
      });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const countryOptions = useMemo(
    () =>
      countries.map((c: any) => ({ label: `${c.name_cn || c.name_en} (#${c.id})`, value: c.id })),
    []
  );

  const fetchList = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = await adminApi.getPricing({
        page,
        limit: pageSize,
        ...filters,
      });
      if (res.success && res.data) {
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        const total = res.data.pagination?.total ?? 0;
        setData(list);
        setPagination({ current: page, pageSize, total });
        // update group list if drawer open
        if (groupDrawerOpen) {
          if (groupMode === "service") {
            setGroupList(list.filter((x: any) => x.service_code === groupKey));
          } else {
            setGroupList(list.filter((x: any) => x.country_id === groupKey));
          }
        }
      }
    } catch (e) {
      message.error(t("adminPricing.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };

  const openGroupDrawer = (mode: "service" | "country", key: string | number) => {
    setGroupMode(mode);
    setGroupKey(key);
    const list = data.filter((x: any) => (mode === "service" ? x.service_code === key : x.country_id === key));
    setGroupList(list);
    setGroupDrawerOpen(true);
  };

  useEffect(() => {
    fetchList(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res = await adminApi.upsertPricing(values);
      if (res.success) {
        message.success(t("adminPricing.saved"));
        setModalOpen(false);
        form.resetFields();
        fetchList(pagination.current, pagination.pageSize);
      }
    } catch (e) {}
  };

  const handleUpdate = async (record: any, changes: Partial<any>) => {
    try {
      const res = await adminApi.updatePricing(record.id, changes);
      if (res.success) {
        message.success(t("adminPricing.updated"));
        fetchList(pagination.current, pagination.pageSize);
      }
    } catch (e) {
      message.error(t("adminPricing.updateFailed"));
    }
  };

  const handleDelete = async (record: any) => {
    try {
      const res = await adminApi.deletePricing(record.id);
      if (res.success) {
        message.success(t("adminPricing.deleted"));
        fetchList(pagination.current, pagination.pageSize);
      }
    } catch (e) {
      message.error(t("adminPricing.deleteFailed"));
    }
  };

  const columns = [
    {
      title: t("adminPricing.service"),
      dataIndex: "service_code",
      key: "service_code",
      render: (v: string) => {
        const iconUrl = `https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${v}0.webp`;
        return (
          <Space>
            <img
              src={iconUrl}
              alt={v}
              style={{ width: 20, height: 20, borderRadius: 4 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              onClick={() => openGroupDrawer("service", v)}
            />
            <Tooltip title={t("adminPricing.editAllForService")}>
              <Tag
                color="blue"
                style={{ cursor: "pointer" }}
                onClick={() => openGroupDrawer("service", v)}
              >
                {v}
              </Tag>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: t("adminPricing.country"),
      dataIndex: "country_id",
      key: "country_id",
      render: (id: number) => {
        const c = countries.find((x: any) => x.id === id);
        const label = c ? `${c.name_cn || c.name_en} (#${id})` : `#${id}`;
        return (
          <Space>
            {c?.flag ? (
              <img
                src={c.flag}
                alt={label}
                style={{ width: 20, height: 14, borderRadius: 2 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                onClick={() => openGroupDrawer("country", id)}
              />
            ) : null}
            <Tooltip title={t("adminPricing.editAllForCountry")}>
              <span style={{ color: "#1677ff", cursor: "pointer" }} onClick={() => openGroupDrawer("country", id)}>
                {label}
              </span>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: t("adminPricing.price"),
      dataIndex: "price",
      key: "price",
      render: (v: number, record: any) => (
        <Space>
          <Text strong>${v?.toFixed ? v.toFixed(2) : v}</Text>
          <InputNumber
            min={0.01}
            step={0.01}
            value={record._editPrice ?? v}
            onChange={(val) => {
              record._editPrice = Number(val);
            }}
            style={{ width: 120 }}
          />
          <Button size="small" onClick={() => handleUpdate(record, { price: record._editPrice })}>
            {t("common.save")}
          </Button>
        </Space>
      ),
    },
    {
      title: t("adminPricing.enabled"),
      dataIndex: "enabled",
      key: "enabled",
      render: (v: boolean, record: any) => (
        <Space>
          <Tag color={v ? "green" : "default"}>{v ? t("common.yes") : t("common.no")}</Tag>
          <Button size="small" onClick={() => handleUpdate(record, { enabled: !v })}>
            {t("adminPricing.toggle")}
          </Button>
        </Space>
      ),
    },
    {
      title: t("adminPricing.actions"),
      key: "actions",
      render: (_: any, record: any) => (
        <Space>
          <Popconfirm title={t("common.confirm")} onConfirm={() => handleDelete(record)}>
            <Button danger size="small">{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Row gutter={[16, 16]}>
        {/* Left: Services */}
        <Col xs={24} lg={6}>
          <Title level={5}>{t("adminPricing.servicesList")}</Title>
          <Input allowClear placeholder={t("adminPricing.searchService") || ""} onChange={(e) => setFilters((f) => ({ ...f, service_code: e.target.value || undefined }))} style={{ marginBottom: 8 }} />
          <div style={{ maxHeight: 560, overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 8, padding: 8 }}>
            {serviceOptions.map((opt) => (
              <div key={opt.value} style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 6, background: opt.value === filters.service_code ? "#e6f7ff" : undefined, cursor: "pointer", marginBottom: 4 }} onClick={() => setFilters((f) => ({ ...f, service_code: f.service_code === opt.value ? undefined : (opt.value as string) }))}>
                <img src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${opt.value}0.webp`} alt={String(opt.value)} style={{ width: 20, height: 20, borderRadius: 4, marginRight: 8 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        </Col>

        {/* Middle: Countries */}
        <Col xs={24} lg={8}>
          <Title level={5}>{t("adminPricing.countriesList")}</Title>
          <Input allowClear placeholder={t("adminPricing.searchCountry") || ""} onChange={(e) => setFilters((f) => ({ ...f, country_id: undefined, _countrySearch: e.target.value }))} style={{ marginBottom: 8 }} />
          <div style={{ maxHeight: 560, overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 8, padding: 8 }}>
            {countryOptions
              .filter((c) => {
                const q = (filters as any)._countrySearch?.toLowerCase?.() || "";
                return !q || (c.label as string).toLowerCase().includes(q);
              })
              .map((opt) => (
                <div key={opt.value} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: opt.value === filters.country_id ? "#e6f7ff" : undefined, cursor: "pointer", marginBottom: 4 }} onClick={() => setFilters((f) => ({ ...f, country_id: f.country_id === opt.value ? undefined : (opt.value as number) }))}>
                  <Space>
                    <img src={countries.find((x: any) => x.id === opt.value)?.flag} alt={String(opt.label)} style={{ width: 20, height: 14, borderRadius: 2 }} />
                    <span>{opt.label}</span>
                  </Space>
                </div>
              ))}
          </div>
        </Col>

        {/* Right: Editor */}
        <Col xs={24} lg={10}>
          <Title level={5}>{t("adminPricing.editorTitle")}</Title>
          <EditorPanel
            t={t}
            filters={filters}
            adminApi={adminApi}
            refresh={() => fetchList(pagination.current, pagination.pageSize)}
          />
        </Col>
      </Row>

      <Modal
        title={t("adminPricing.modalTitle")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText={t("common.save")}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="service_code" label={t("adminPricing.service")} rules={[{ required: true }]}> 
            <Select showSearch options={serviceOptions} filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="country_id" label={t("adminPricing.country")} rules={[{ required: true }]}> 
            <Select showSearch options={countryOptions} filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="price" label={t("adminPricing.priceWithCurrency", { currency: "USD" })} rules={[{ required: true }]}> 
            <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="enabled" label={t("adminPricing.enabled")} initialValue={true}>
            <Select options={[{ label: t("common.yes"), value: true }, { label: t("common.no"), value: false }]} />
          </Form.Item>
          <Form.Item name="notes" label={t("adminPricing.notes")}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Set Price for selected */}
      <Modal
        title={t("adminPricing.setPrice")}
        open={setPriceModalOpen}
        onCancel={() => setSetPriceModalOpen(false)}
        onOk={async () => {
          if (!setPriceValue || selectedRows.length === 0) return;
          setBatchLoading(true);
          try {
            // Process requests sequentially with small delay to avoid overwhelming the server
            for (let i = 0; i < selectedRows.length; i++) {
              const r = selectedRows[i];
              try {
                await adminApi.updatePricing(r.id, { price: setPriceValue! });
                // Small delay between requests to prevent overwhelming the server
                if (i < selectedRows.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              } catch (error) {
                console.error(`Failed to update pricing for row ${i + 1}:`, error);
                // Continue with other updates even if one fails
              }
            }
            message.success(t("adminPricing.updated"));
            setSetPriceModalOpen(false);
            setSetPriceValue(null);
            fetchList(pagination.current, pagination.pageSize);
          } catch (e) {
            message.error(t("adminPricing.updateFailed"));
          } finally {
            setBatchLoading(false);
          }
        }}
        okText={t("common.save")}
      >
        <Space>
          <Text>{t("adminPricing.setPriceTo")}</Text>
          <InputNumber min={0.01} step={0.01} value={setPriceValue ?? undefined} onChange={(v) => setSetPriceValue(Number(v))} />
        </Space>
      </Modal>

      {/* Group drawer */}
      <Drawer
        title={
          groupMode === "service"
            ? t("adminPricing.groupEditServiceTitle", { service: groupKey })
            : t("adminPricing.groupEditCountryTitle", { country: groupKey })
        }
        placement="right"
        width={420}
        onClose={() => setGroupDrawerOpen(false)}
        open={groupDrawerOpen}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {groupList.map((row) => (
            <div key={`${row.service_code}_${row.country_id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{row.service_code}</div>
                <div style={{ color: "#888" }}>{row.country_id}</div>
              </div>
              <Space>
                <InputNumber min={0.01} step={0.01} value={row._editPrice ?? row.price} onChange={(v) => { row._editPrice = Number(v); }} />
              </Space>
            </div>
          ))}
          <Button loading={groupSaving} type="primary" onClick={async () => {
            try {
              setGroupSaving(true);
              // Process requests sequentially with small delay to avoid overwhelming the server
              for (let i = 0; i < groupList.length; i++) {
                const r = groupList[i];
                try {
                  await adminApi.updatePricing(r.id, { price: r._editPrice ?? r.price });
                  // Small delay between requests to prevent overwhelming the server
                  if (i < groupList.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                } catch (error) {
                  console.error(`Failed to update pricing for row ${i + 1}:`, error);
                  // Continue with other updates even if one fails
                }
              }
              message.success(t("adminPricing.updated"));
              setGroupDrawerOpen(false);
              fetchList(pagination.current, pagination.pageSize);
            } catch (e) {
              message.error(t("adminPricing.updateFailed"));
            } finally {
              setGroupSaving(false);
            }
          }}>{t("adminPricing.saveAll")}</Button>
        </Space>
      </Drawer>
    </Card>
  );
};


function applyOp(old: number, op: "increase" | "decrease" | "multiply", value: number) {
  switch (op) {
    case "increase":
      return old + value;
    case "decrease":
      return Math.max(0.01, old - value);
    case "multiply":
      return old * value;
    default:
      return old;
  }
}

export default AdminPricingPage;

// Editor panel component for the 3-pane layout
const EditorPanel: React.FC<{
  t: any;
  filters: any;
  adminApi: typeof adminApi;
  refresh: () => void;
}> = ({ t, filters, adminApi, refresh }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [value, setValue] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const all: any[] = [];
        let page = 1;
        const limit = 100; // respect backend validation
        // paginate until we've fetched all
        // guard to avoid infinite loops
        for (let i = 0; i < 50; i += 1) {
          const res = await adminApi.getPricing({
            page,
            limit,
            service_code: filters.service_code,
            country_id: filters.country_id,
          });
          if (res.success && res.data) {
            const list = res.data.data || [];
            all.push(...list);
            const total = res.data.pagination?.total ?? 0;
            if (all.length >= total || list.length < limit) break;
            page += 1;
          } else {
            break;
          }
        }
        setRows(all);
      } finally {
        setLoading(false);
      }
    };
    if (filters.service_code || filters.country_id) load();
    else setRows([]);
  }, [filters.service_code, filters.country_id]);

  const applySetPrice = async () => {
    if (rows.length === 0 || value === null || value === undefined) return;
    setLoading(true);
    try {
      // Process requests sequentially with small delay to avoid overwhelming the server
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          await adminApi.updatePricing(r.id, { price: value! });
          // Small delay between requests to prevent overwhelming the server
          if (i < rows.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Failed to update pricing for row ${i + 1}:`, error);
          // Continue with other updates even if one fails
        }
      }
      // immediate UI update
      setRows((prev) => prev.map((r) => ({ ...r, price: value!, _editPrice: undefined })));
      refresh();
    } finally {
      setLoading(false);
    }
  };

  const applyToggle = async (to: boolean) => {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      // Process requests sequentially with small delay to avoid overwhelming the server
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          await adminApi.updatePricing(r.id, { enabled: to });
          // Small delay between requests to prevent overwhelming the server
          if (i < rows.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Failed to update enabled status for row ${i + 1}:`, error);
          // Continue with other updates even if one fails
        }
      }
      // immediate UI update
      setRows((prev) => prev.map((r) => ({ ...r, enabled: to })));
      refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card loading={loading} bodyStyle={{ minHeight: 560 }}>
      {(!filters.service_code && !filters.country_id) && (
        <Alert type="info" showIcon message={t("adminPricing.editorHint") || ""} />
      )}

      {(filters.service_code || filters.country_id) && (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space wrap>
            <InputNumber min={0.01} step={0.01} placeholder={t("adminPricing.setPriceTo") || ""} value={value ?? undefined} onChange={(v) => setValue(Number(v))} />
            <Button type="primary" onClick={applySetPrice} disabled={!rows.length || !value} loading={loading}>
              {t("adminPricing.applyBatch")}
            </Button>
            <Button onClick={() => applyToggle(true)} disabled={!rows.length} loading={loading}>{t("adminPricing.enable")}</Button>
            <Button onClick={() => applyToggle(false)} disabled={!rows.length} loading={loading}>{t("adminPricing.disable")}</Button>
          </Space>

          <Divider style={{ margin: "12px 0" }} />

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Space>
                  <img src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${r.service_code}0.webp`} alt={r.service_code} style={{ width: 18, height: 18, borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <Tag>{r.service_code}</Tag>
                  <img src={countries.find((x: any) => x.id === r.country_id)?.flag} alt={String(r.country_id)} style={{ width: 18, height: 12, borderRadius: 2 }} />
                  <span>#{r.country_id}</span>
                </Space>
                <Space>
                  <InputNumber min={0.01} step={0.01} value={r._editPrice ?? r.price} onChange={(v) => { r._editPrice = Number(v); setRows((prev)=>prev.map((x)=> x.id===r.id? {...x, _editPrice: Number(v)}: x)); }} />
                  <Button size="small" onClick={async () => {
                    const newPrice = r._editPrice ?? r.price;
                    await adminApi.updatePricing(r.id, { price: newPrice });
                    // immediate UI update for this row
                    setRows((prev)=>prev.map((x)=> x.id===r.id? {...x, price: newPrice, _editPrice: undefined}: x));
                    refresh();
                  }}>{t("common.save")}</Button>
                </Space>
              </div>
            ))}
          </div>
        </Space>
      )}
    </Card>
  );
};


